import React, { Dispatch, SetStateAction } from "react";
import { List } from "immutable";
import { UnsignedEvent, Event } from "nostr-tools";
import crypto from "crypto";
import {
  newTimestamp,
  KIND_RELAY_METADATA_EVENT,
  mergePublishResultsOfEvents,
  getWriteRelays,
} from "citadel-commons";
import { v4 } from "uuid";
import {
  KIND_DELETE,
  KIND_KNOWLEDGE_LIST,
  KIND_KNOWLEDGE_NODE,
  KIND_CONTACTLIST,
  KIND_VIEWS,
  KIND_WORKSPACES,
  KIND_SETTINGS,
} from "./nostr";
import { useData } from "./DataContext";
import { execute, republishEvents } from "./executor";
import { useApis } from "./Apis";
import { viewsToJSON } from "./serializer";
import { newDB } from "./knowledge";
import { isIDRemote, joinID, shortID, splitID } from "./connections";
import { DEFAULT_WS_NAME } from "./KnowledgeDataContext";
import { UNAUTHENTICATED_USER_PK } from "./AppState";

export type Plan = Data & {
  publishEvents: List<UnsignedEvent>;
};

function newContactListEvent(contacts: Contacts, user: User): UnsignedEvent {
  const tags = contacts
    .valueSeq()
    .toArray()
    .map((c) => {
      if (c.mainRelay && c.userName) {
        return ["p", c.publicKey, c.mainRelay, c.userName];
      }
      if (c.mainRelay) {
        return ["p", c.publicKey, c.mainRelay];
      }
      if (c.userName) {
        return ["p", c.publicKey, c.userName];
      }
      return ["p", c.publicKey];
    });
  return {
    kind: KIND_CONTACTLIST,
    pubkey: user.publicKey,
    created_at: newTimestamp(),
    tags,
    content: "",
  };
}

export function planAddContact(plan: Plan, publicKey: PublicKey): Plan {
  if (plan.contacts.has(publicKey)) {
    return plan;
  }
  const newContact: Contact = {
    publicKey,
  };
  const newContacts = plan.contacts.set(publicKey, newContact);
  const contactListEvent = newContactListEvent(newContacts, plan.user);
  return {
    ...plan,
    publishEvents: plan.publishEvents.push(contactListEvent),
  };
}

export function planAddContacts(plan: Plan, publicKeys: List<PublicKey>): Plan {
  const newContacts = publicKeys.reduce((rdx, publicKey) => {
    if (rdx.has(publicKey)) {
      return rdx;
    }
    const newContact: Contact = {
      publicKey,
    };
    return rdx.set(publicKey, newContact);
  }, plan.contacts);

  const contactListEvent = newContactListEvent(newContacts, plan.user);
  return {
    ...plan,
    publishEvents: plan.publishEvents.push(contactListEvent),
  };
}

export function planRemoveContact(plan: Plan, publicKey: PublicKey): Plan {
  const contactToRemove = plan.contacts.get(publicKey);
  if (!contactToRemove) {
    return plan;
  }
  const newContacts = plan.contacts.remove(publicKey);
  const contactListEvent = newContactListEvent(newContacts, plan.user);
  return {
    ...plan,
    publishEvents: plan.publishEvents.push(contactListEvent),
  };
}

export function planUpsertRelations(plan: Plan, relations: Relations): Plan {
  const userDB = plan.knowledgeDBs.get(plan.user.publicKey, newDB());
  const updatedRelations = userDB.relations.set(
    shortID(relations.id),
    relations
  );
  const updatedDB = {
    ...userDB,
    relations: updatedRelations,
  };
  const itemsAsTags = relations.items.toArray().map((i) => ["i", i]);
  const updateRelationsEvent = {
    kind: KIND_KNOWLEDGE_LIST,
    pubkey: plan.user.publicKey,
    created_at: newTimestamp(),
    tags: [
      ["d", shortID(relations.id)],
      // Cannot use fullID here because we need to query for short IDs
      ["k", shortID(relations.head)],
      // Full ID Head
      ["head", relations.head],
      ["rel_type", relations.type],
      ...itemsAsTags,
    ],
    content: "",
  };
  return {
    ...plan,
    knowledgeDBs: plan.knowledgeDBs.set(plan.user.publicKey, updatedDB),
    publishEvents: plan.publishEvents.push(updateRelationsEvent),
  };
}

export function planUpsertNode(plan: Plan, node: KnowNode): Plan {
  const userDB = plan.knowledgeDBs.get(plan.user.publicKey, newDB());
  const updatedNodes = userDB.nodes.set(shortID(node.id), node);
  const updatedDB = {
    ...userDB,
    nodes: updatedNodes,
  };
  const updateNodeEvent = {
    kind: KIND_KNOWLEDGE_NODE,
    pubkey: plan.user.publicKey,
    created_at: newTimestamp(),
    tags: [["d", shortID(node.id)]],
    content: node.text,
  };
  return {
    ...plan,
    knowledgeDBs: plan.knowledgeDBs.set(plan.user.publicKey, updatedDB),
    publishEvents: plan.publishEvents.push(updateNodeEvent),
  };
}

export function planBulkUpsertNodes(plan: Plan, nodes: KnowNode[]): Plan {
  return nodes.reduce((p, node) => planUpsertNode(p, node), plan);
}

function planDelete(plan: Plan, id: LongID | ID, kind: number): Plan {
  const deleteEvent = {
    kind: KIND_DELETE,
    pubkey: plan.user.publicKey,
    created_at: newTimestamp(),
    tags: [["a", `${kind}:${plan.user.publicKey}:${shortID(id)}`]],
    content: "",
  };
  return {
    ...plan,
    publishEvents: plan.publishEvents.push(deleteEvent),
  };
}

export function planDeleteNode(plan: Plan, nodeID: LongID | ID): Plan {
  const deletePlan = planDelete(plan, nodeID, KIND_KNOWLEDGE_NODE);
  const userDB = plan.knowledgeDBs.get(deletePlan.user.publicKey, newDB());
  const updatedNodes = userDB.nodes.remove(shortID(nodeID));
  const updatedDB = {
    ...userDB,
    nodes: updatedNodes,
  };
  return {
    ...deletePlan,
    knowledgeDBs: plan.knowledgeDBs.set(plan.user.publicKey, updatedDB),
  };
}

export function planDeleteRelations(plan: Plan, relationsID: LongID): Plan {
  const deletePlan = planDelete(plan, relationsID, KIND_KNOWLEDGE_LIST);
  const userDB = plan.knowledgeDBs.get(deletePlan.user.publicKey, newDB());
  const updatedRelations = userDB.relations.remove(shortID(relationsID));
  const updatedDB = {
    ...userDB,
    relations: updatedRelations,
  };
  return {
    ...deletePlan,
    knowledgeDBs: plan.knowledgeDBs.set(plan.user.publicKey, updatedDB),
  };
}

export function planUpdateViews(plan: Plan, views: Views): Plan {
  // filter previous events for views
  const publishEvents = plan.publishEvents.filterNot(
    (event) => event.kind === KIND_VIEWS
  );
  const writeViewEvent = {
    kind: KIND_VIEWS,
    pubkey: plan.user.publicKey,
    created_at: newTimestamp(),
    tags: [],
    content: JSON.stringify(viewsToJSON(views)),
  };
  return {
    ...plan,
    views,
    publishEvents: publishEvents.push(writeViewEvent),
  };
}

export function fallbackWorkspace(publicKey: PublicKey): LongID {
  return joinID(publicKey, v4());
}

function isWsMissing(plan: Plan, workspace: LongID): boolean {
  const remote = splitID(workspace)[0];
  if (
    isIDRemote(workspace, plan.user.publicKey) &&
    remote &&
    plan.contacts.has(remote)
  ) {
    return false;
  }
  return !plan.workspaces.includes(workspace);
}

export function planUpdateWorkspaces(
  plan: Plan,
  workspaces: List<ID>,
  activeWorkspace: LongID | undefined
): Plan {
  const newActiveWs = activeWorkspace || fallbackWorkspace(plan.user.publicKey);
  const newWorkspaces = isWsMissing({ ...plan, workspaces }, newActiveWs)
    ? workspaces.push(newActiveWs)
    : workspaces;
  const serialized = {
    w: newWorkspaces.toArray(),
    a: newActiveWs,
  };
  const writeWorkspacesEvent = {
    kind: KIND_WORKSPACES,
    pubkey: plan.user.publicKey,
    created_at: newTimestamp(),
    tags: [],
    content: JSON.stringify(serialized),
  };
  return {
    ...plan,
    workspaces: newWorkspaces,
    activeWorkspace: newActiveWs,
    publishEvents: plan.publishEvents.push(writeWorkspacesEvent),
  };
}

function isRemoteWorkspace(plan: Plan): boolean {
  const isRemote = isIDRemote(plan.activeWorkspace, plan.user.publicKey);
  const remote = splitID(plan.activeWorkspace)[0];
  return isRemote && !!remote && plan.contacts.has(remote);
}

export function planUpdateWorkspaceIfNecessary(plan: Plan): Plan {
  return !isRemoteWorkspace(plan) && isWsMissing(plan, plan.activeWorkspace)
    ? planUpdateWorkspaces(plan, plan.workspaces, plan.activeWorkspace)
    : plan;
}

export function planUpsertFallbackWorkspaceIfNecessary(plan: Plan): Plan {
  // test if the node exists
  const node = plan.knowledgeDBs
    .get(plan.user.publicKey)
    ?.nodes.get(shortID(plan.activeWorkspace));
  return !isRemoteWorkspace(plan) && !node
    ? planUpsertNode(plan, {
        id: plan.activeWorkspace,
        text: DEFAULT_WS_NAME,
      })
    : plan;
}

export function replaceUnauthenticatedUser<T extends string>(
  from: T,
  publicKey: string
): T {
  // TODO: This feels quite dangerous
  return from.replaceAll(UNAUTHENTICATED_USER_PK, publicKey) as T;
}

function rewriteIDs(event: UnsignedEvent): UnsignedEvent {
  const replacedTags = event.tags.map((tag) =>
    tag.map((t) => replaceUnauthenticatedUser(t, event.pubkey))
  );
  return {
    ...event,
    content: replaceUnauthenticatedUser(event.content, event.pubkey),
    tags: replacedTags,
  };
}

export function planRewriteWorkspaceIDs(plan: Plan): Plan {
  const rewrittenWorkspaces = plan.workspaces.reduce((rdx, wsID) => {
    return rdx.merge(replaceUnauthenticatedUser(wsID, plan.user.publicKey));
  }, List<string>());
  const rewrittenActiveWorkspace = replaceUnauthenticatedUser(
    plan.activeWorkspace,
    plan.user.publicKey
  );
  return {
    ...plan,
    workspaces: rewrittenWorkspaces,
    activeWorkspace: rewrittenActiveWorkspace,
  };
}

export function planRewriteUnpublishedEvents(
  plan: Plan,
  events: List<UnsignedEvent>
): Plan {
  const allEvents = plan.publishEvents.concat(events);
  const rewrittenEvents = allEvents.map((event) =>
    rewriteIDs({
      ...event,
      pubkey: plan.user.publicKey,
    })
  );
  return {
    ...plan,
    publishEvents: rewrittenEvents,
  };
}

export function planPublishSettings(plan: Plan, settings: Settings): Plan {
  const compressedSettings: CompressedSettings = {
    b: settings.bionicReading,
    v: "v1",
    n: crypto.randomBytes(8),
  };
  const content = JSON.stringify(compressedSettings);
  const publishSettingsEvent = {
    kind: KIND_SETTINGS,
    pubkey: plan.user.publicKey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content,
  };
  return {
    ...plan,
    publishEvents: plan.publishEvents.push(publishSettingsEvent),
  };
}

export function relayTags(relays: Relays): string[][] {
  return relays.map((r) => {
    if (r.read && r.write) {
      return ["r", r.url];
    }
    if (r.read) {
      return ["r", r.url, "read"];
    }
    if (r.write) {
      return ["r", r.url, "write"];
    }
    return [];
  });
}

export function planPublishRelayMetadata(plan: Plan, relays: Relays): Plan {
  const tags = relayTags(relays);
  const publishRelayMetadataEvent = {
    kind: KIND_RELAY_METADATA_EVENT,
    pubkey: plan.user.publicKey,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: "",
  };
  return {
    ...plan,
    publishEvents: plan.publishEvents.push(publishRelayMetadataEvent),
  };
}

type ExecutePlan = (plan: Plan) => Promise<void>;

type Planner = {
  createPlan: () => Plan;
  executePlan: ExecutePlan;
  republishEvents: RepublishEvents;
  setPublishEvents: Dispatch<SetStateAction<EventState>>;
};

type Context = Pick<
  Planner,
  "executePlan" | "republishEvents" | "setPublishEvents"
>;

const PlanningContext = React.createContext<Context | undefined>(undefined);

export function PlanningContextProvider({
  children,
  setPublishEvents,
}: {
  children: React.ReactNode;
  setPublishEvents: Dispatch<SetStateAction<EventState>>;
}): JSX.Element {
  const { relayPool, finalizeEvent } = useApis();

  const executePlan = async (plan: Plan): Promise<void> => {
    setPublishEvents((prevStatus) => {
      return {
        unsignedEvents: prevStatus.unsignedEvents.merge(plan.publishEvents),
        results: prevStatus.results,
        isLoading: true,
        preLoginEvents: prevStatus.preLoginEvents,
      };
    });

    const planWithWs = planUpsertFallbackWorkspaceIfNecessary(
      planUpdateWorkspaceIfNecessary(plan)
    );
    const results = await execute({
      plan: planWithWs,
      relayPool,
      relays: getWriteRelays(plan.relays),
      finalizeEvent,
    });

    setPublishEvents((prevStatus) => {
      return {
        unsignedEvents: prevStatus.unsignedEvents,
        results: mergePublishResultsOfEvents(prevStatus.results, results),
        isLoading: false,
        preLoginEvents: prevStatus.preLoginEvents,
      };
    });
  };

  const republishEventsOnRelay = async (
    events: List<Event>,
    relayUrl: string
  ): Promise<void> => {
    const results = await republishEvents({
      events,
      relayPool,
      writeRelayUrl: relayUrl,
    });
    setPublishEvents((prevStatus) => {
      return {
        unsignedEvents: prevStatus.unsignedEvents,
        results: mergePublishResultsOfEvents(prevStatus.results, results),
        isLoading: false,
        preLoginEvents: prevStatus.preLoginEvents,
      };
    });
  };

  return (
    <PlanningContext.Provider
      value={{
        executePlan,
        republishEvents: republishEventsOnRelay,
        setPublishEvents,
      }}
    >
      {children}
    </PlanningContext.Provider>
  );
}

export function createPlan(
  props: Data & {
    publishEvents?: List<UnsignedEvent>;
  }
): Plan {
  return {
    ...props,
    publishEvents: props.publishEvents || List<UnsignedEvent>([]),
  };
}

export function usePlanner(): Planner {
  const data = useData();
  const createPlanningContext = (): Plan => {
    return createPlan({
      ...data,
    });
  };
  const planningContext = React.useContext(PlanningContext);
  if (planningContext === undefined) {
    throw new Error("PlanningContext not provided");
  }

  return {
    createPlan: createPlanningContext,
    executePlan: planningContext.executePlan,
    republishEvents: planningContext.republishEvents,
    setPublishEvents: planningContext.setPublishEvents,
  };
}
