import React from "react";
import { Map, List } from "immutable";
import { Event } from "nostr-tools";
import { useData } from "./DataContext";
import { execute } from "./executor";
import { useApis, FinalizeEvent } from "./Apis";
import {
  relationTypesToJson,
  relationsToJSON,
  viewsToJSON,
} from "./serializer";
import {
  KIND_DELETE,
  KIND_KNOWLEDGE_LIST,
  KIND_KNOWLEDGE_NODE,
  KIND_RELATION_TYPES,
  KIND_CONTACTLIST,
  KIND_VIEWS,
  KIND_WORKSPACES,
  newTimestamp,
} from "./nostr";
import { newDB } from "./knowledge";
import { shortID } from "./connections";

type Context = (plan: Plan) => Promise<void>;

const PlanningContext = React.createContext<Context | undefined>(undefined);

export type Plan = Data & {
  publishEvents: List<Event>;
};

export function PlanningContextProvider({
  children,
  addNewEvents,
}: {
  children: React.ReactNode;
  addNewEvents: (events: Map<string, Event>) => void;
}): JSX.Element {
  const data = useData();
  const { relayPool } = useApis();
  const writeRelays = data.relays.filter((r) => r.write === true);

  const executePlan = async (plan: Plan): Promise<void> => {
    // TODO: this needs a lot of error handling etc...
    addNewEvents(Map(plan.publishEvents.map((e) => [e.id, e])));
    return execute({
      plan,
      relayPool,
      relays: writeRelays,
    });
  };

  return (
    <PlanningContext.Provider value={executePlan}>
      {children}
    </PlanningContext.Provider>
  );
}

type Planner = {
  createPlan: () => Plan;
  executePlan: (plan: Plan) => Promise<void>;
};

export function createPlan(
  props: Data & {
    publishEvents?: List<Event>;
  }
): Plan {
  return {
    ...props,
    publishEvents: props.publishEvents || List<Event>([]),
  };
}

export function usePlanner(): Planner {
  const data = useData();
  const createPlanningContext = (): Plan => {
    return createPlan({
      ...data,
    });
  };
  const executePlan = React.useContext(PlanningContext);
  if (executePlan === undefined) {
    throw new Error("PlanningContext not provided");
  }

  return {
    createPlan: createPlanningContext,
    executePlan,
  };
}

function newContactListEvent(
  contacts: Contacts,
  user: KeyPair,
  finalizeEvent: FinalizeEvent
): Event {
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
  return finalizeEvent(
    {
      kind: KIND_CONTACTLIST,
      created_at: newTimestamp(),
      tags,
      content: "",
    },
    user.privateKey
  );
}

export function planAddContact(
  plan: Plan,
  publicKey: PublicKey,
  finalizeEvent: FinalizeEvent
): Plan {
  if (plan.contacts.has(publicKey)) {
    return plan;
  }
  const newContact: Contact = {
    publicKey,
  };
  const newContacts = plan.contacts.set(publicKey, newContact);
  const contactListEvent = newContactListEvent(
    newContacts,
    plan.user,
    finalizeEvent
  );
  return {
    ...plan,
    publishEvents: plan.publishEvents.push(contactListEvent),
  };
}

export function planRemoveContact(
  plan: Plan,
  publicKey: PublicKey,
  finalizeEvent: FinalizeEvent
): Plan {
  const contactToRemove = plan.contacts.get(publicKey);
  if (!contactToRemove) {
    return plan;
  }
  const newContacts = plan.contacts.remove(publicKey);
  const contactListEvent = newContactListEvent(
    newContacts,
    plan.user,
    finalizeEvent
  );
  return {
    ...plan,
    publishEvents: plan.publishEvents.push(contactListEvent),
  };
}

export function planUpsertRelations(
  plan: Plan,
  relations: Relations,
  finalizeEvent: FinalizeEvent
): Plan {
  const userDB = plan.knowledgeDBs.get(plan.user.publicKey, newDB());
  const updatedRelations = userDB.relations.set(
    shortID(relations.id),
    relations
  );
  const updatedDB = {
    ...userDB,
    relations: updatedRelations,
  };
  const updateRelationsEvent = finalizeEvent(
    {
      kind: KIND_KNOWLEDGE_LIST,
      created_at: newTimestamp(),
      tags: [["d", shortID(relations.id)]],
      content: JSON.stringify(relationsToJSON(relations)),
    },
    plan.user.privateKey
  );
  return {
    ...plan,
    knowledgeDBs: plan.knowledgeDBs.set(plan.user.publicKey, updatedDB),
    publishEvents: plan.publishEvents.push(updateRelationsEvent),
  };
}

export function planUpsertNode(
  plan: Plan,
  node: KnowNode,
  finalizeEvent: FinalizeEvent
): Plan {
  const userDB = plan.knowledgeDBs.get(plan.user.publicKey, newDB());
  const updatedNodes = userDB.nodes.set(shortID(node.id), node);
  const updatedDB = {
    ...userDB,
    nodes: updatedNodes,
  };
  const updateNodeEvent = finalizeEvent(
    {
      kind: KIND_KNOWLEDGE_NODE,
      created_at: newTimestamp(),
      tags: [["d", shortID(node.id)]],
      content: node.text,
    },
    plan.user.privateKey
  );
  return {
    ...plan,
    knowledgeDBs: plan.knowledgeDBs.set(plan.user.publicKey, updatedDB),
    publishEvents: plan.publishEvents.push(updateNodeEvent),
  };
}

export function planBulkUpsertNodes(
  plan: Plan,
  nodes: KnowNode[],
  finalizeEvent: FinalizeEvent
): Plan {
  return nodes.reduce(
    (p, node) => planUpsertNode(p, node, finalizeEvent),
    plan
  );
}

function planDelete(
  plan: Plan,
  id: LongID,
  kind: number,
  finalizeEvent: FinalizeEvent
): Plan {
  const deleteEvent = finalizeEvent(
    {
      kind: KIND_DELETE,
      created_at: newTimestamp(),
      tags: [["a", `${kind}:${plan.user.publicKey}:${shortID(id)}`]],
      content: "",
    },
    plan.user.privateKey
  );
  return {
    ...plan,
    publishEvents: plan.publishEvents.push(deleteEvent),
  };
}

export function planDeleteNode(
  plan: Plan,
  nodeID: LongID,
  finalizeEvent: FinalizeEvent
): Plan {
  const deletePlan = planDelete(
    plan,
    nodeID,
    KIND_KNOWLEDGE_NODE,
    finalizeEvent
  );
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

export function planDeleteRelations(
  plan: Plan,
  relationsID: LongID,
  finalizeEvent: FinalizeEvent
): Plan {
  const deletePlan = planDelete(
    plan,
    relationsID,
    KIND_KNOWLEDGE_LIST,
    finalizeEvent
  );
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

export function planUpdateViews(
  plan: Plan,
  views: Views,
  finalizeEvent: FinalizeEvent
): Plan {
  const userDB = plan.knowledgeDBs.get(plan.user.publicKey, newDB());
  // filter previous events for views
  const publishEvents = plan.publishEvents.filterNot(
    (event) => event.kind === KIND_VIEWS
  );
  const writeViewEvent = finalizeEvent(
    {
      kind: KIND_VIEWS,
      created_at: newTimestamp(),
      tags: [],
      content: JSON.stringify(viewsToJSON(views)),
    },
    plan.user.privateKey
  );
  return {
    ...plan,
    knowledgeDBs: plan.knowledgeDBs.set(plan.user.publicKey, {
      ...userDB,
      views,
    }),
    publishEvents: publishEvents.push(writeViewEvent),
  };
}

export function planUpdateWorkspaces(
  plan: Plan,
  workspaces: List<ID>,
  activeWorkspace: LongID,
  finalizeEvent: FinalizeEvent
): Plan {
  const userDB = plan.knowledgeDBs.get(plan.user.publicKey, newDB());
  const serialized = {
    w: workspaces.toArray(),
    a: activeWorkspace,
  };
  const writeWorkspacesEvent = finalizeEvent(
    {
      kind: KIND_WORKSPACES,
      created_at: newTimestamp(),
      tags: [],
      content: JSON.stringify(serialized),
    },
    plan.user.privateKey
  );
  return {
    ...plan,
    knowledgeDBs: plan.knowledgeDBs.set(plan.user.publicKey, {
      ...userDB,
      workspaces,
      activeWorkspace,
    }),
    publishEvents: plan.publishEvents.push(writeWorkspacesEvent),
  };
}

export function planUpdateRelationTypes(
  plan: Plan,
  relationTypes: RelationTypes,
  finalizeEvent: FinalizeEvent
): Plan {
  const userDB = plan.knowledgeDBs.get(plan.user.publicKey, newDB());
  const serialized = relationTypesToJson(relationTypes);
  const writeRelationsEvent = finalizeEvent(
    {
      kind: KIND_RELATION_TYPES,
      created_at: newTimestamp(),
      tags: [],
      content: JSON.stringify(serialized),
    },
    plan.user.privateKey
  );
  return {
    ...plan,
    knowledgeDBs: plan.knowledgeDBs.set(plan.user.publicKey, {
      ...userDB,
      relationTypes,
    }),
    publishEvents: plan.publishEvents.push(writeRelationsEvent),
  };
}
