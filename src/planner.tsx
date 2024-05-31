import React, { Dispatch, SetStateAction } from "react";
import { List } from "immutable";
import { UnsignedEvent, Event } from "nostr-tools";
import crypto from "crypto";
import {
  KIND_DELETE,
  KIND_KNOWLEDGE_LIST,
  KIND_KNOWLEDGE_NODE,
  KIND_RELATION_TYPES,
  KIND_CONTACTLIST,
  KIND_VIEWS,
  KIND_WORKSPACES,
  newTimestamp,
  KIND_SETTINGS,
  KIND_RELAY_METADATA_EVENT,
} from "citadel-commons";
import { useData } from "./DataContext";
import { execute, republishEvents } from "./executor";
import { useApis } from "./Apis";
import { relationTypesToJson, viewsToJSON } from "./serializer";
import { newDB } from "./knowledge";
import { shortID } from "./connections";

type ExecutePlan = (plan: Plan) => Promise<void>;
type RepublishEvents = (events: List<Event>, relayUrl: string) => Promise<void>;

type Context = {
  executePlan: ExecutePlan;
  republishEvents: RepublishEvents;
};

const PlanningContext = React.createContext<Context | undefined>(undefined);

export type Plan = Data & {
  publishEvents: List<UnsignedEvent>;
};

function mergePublishResultsOfEvents(
  existing: PublishResultsEventMap,
  newResults: PublishResultsEventMap
): PublishResultsEventMap {
  return newResults.reduce((rdx, results, eventID) => {
    const existingResults = rdx.get(eventID);
    if (!existingResults) {
      return rdx.set(eventID, results);
    }
    return rdx.set(eventID, {
      ...existingResults,
      results: existingResults.results.merge(results.results),
    });
  }, existing);
}

export function PlanningContextProvider({
  children,
  setPublishEvents,
}: {
  children: React.ReactNode;
  setPublishEvents: Dispatch<SetStateAction<PublishEvents>>;
}): JSX.Element {
  const { relayPool, finalizeEvent } = useApis();

  const executePlan = async (plan: Plan): Promise<void> => {
    // TODO: Just sign in planner, but non-blocking
    setPublishEvents((prevStatus) => {
      return {
        unsignedEvents: prevStatus.unsignedEvents.merge(plan.publishEvents),
        results: prevStatus.results,
        isLoading: true,
      };
    });

    const results = await execute({
      plan,
      relayPool,
      relays: plan.relays.filter((r) => r.write === true),
      finalizeEvent,
    });

    setPublishEvents((prevStatus) => {
      return {
        unsignedEvents: prevStatus.unsignedEvents,
        results: mergePublishResultsOfEvents(prevStatus.results, results),
        isLoading: false,
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
      };
    });
  };

  return (
    <PlanningContext.Provider
      value={{ executePlan, republishEvents: republishEventsOnRelay }}
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

type Planner = {
  createPlan: () => Plan;
  executePlan: ExecutePlan;
  republishEvents: RepublishEvents;
};

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
  };
}

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
      ["k", shortID(relations.head)],
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

export function planUpdateWorkspaces(
  plan: Plan,
  workspaces: List<ID>,
  activeWorkspace: LongID
): Plan {
  const serialized = {
    w: workspaces.toArray(),
    a: activeWorkspace,
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
    workspaces,
    activeWorkspace,
    publishEvents: plan.publishEvents.push(writeWorkspacesEvent),
  };
}

export function planUpdateRelationTypes(
  plan: Plan,
  relationTypes: RelationTypes
): Plan {
  const serialized = relationTypesToJson(relationTypes);
  const writeRelationsEvent = {
    kind: KIND_RELATION_TYPES,
    pubkey: plan.user.publicKey,
    created_at: newTimestamp(),
    tags: [],
    content: JSON.stringify(serialized),
  };
  return {
    ...plan,
    relationTypes,
    publishEvents: plan.publishEvents.push(writeRelationsEvent),
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
