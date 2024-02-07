import React from "react";
import { Map, List } from "immutable";
import { Event, getPublicKey } from "nostr-tools";
import { useData } from "./DataContext";
import { execute } from "./executor";

import { useApis } from "./Apis";
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
  finalizeEvent,
  newTimestamp,
} from "./nostr";
import { newDB } from "./knowledge";
import { shortID } from "./connections";

type Context = (plan: Plan) => Promise<void>;

export const PlanningContext = React.createContext<Context | undefined>(
  undefined
);

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

export function planAddContact(plan: Plan, publicKey: PublicKey): Plan {
  if (plan.contacts.has(publicKey)) {
    return plan;
  }
  const newContact: Contact = {
    publicKey,
  };
  const contacts = plan.contacts.set(publicKey, newContact);
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
  const addContactEvent = finalizeEvent(
    {
      kind: KIND_CONTACTLIST,
      pubkey: plan.user.publicKey,
      created_at: newTimestamp(),
      tags,
      content: "",
    },
    plan.user.privateKey
  );
  return {
    ...plan,
    publishEvents: plan.publishEvents.push(addContactEvent),
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
  const updateRelationsEvent = finalizeEvent(
    {
      kind: KIND_KNOWLEDGE_LIST,
      pubkey: plan.user.publicKey,
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

export function planUpsertNode(plan: Plan, node: KnowNode): Plan {
  const userDB = plan.knowledgeDBs.get(plan.user.publicKey, newDB());
  const updatedNodes = userDB.nodes.set(shortID(node.id), node);
  const updatedDB = {
    ...userDB,
    nodes: updatedNodes,
  };
  const updateNodeEvent = finalizeEvent(
    {
      kind: KIND_KNOWLEDGE_NODE,
      pubkey: plan.user.publicKey,
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

export function planBulkUpsertNodes(plan: Plan, nodes: KnowNode[]): Plan {
  return nodes.reduce((p, node) => planUpsertNode(p, node), plan);
}

export function planBulkUpsertRelations(
  plan: Plan,
  relations: Relations[]
): Plan {
  return relations.reduce(
    (p, relation) => planUpsertRelations(p, relation),
    plan
  );
}

function planDelete(plan: Plan, id: LongID, kind: number): Plan {
  const deleteEvent = finalizeEvent(
    {
      kind: KIND_DELETE,
      pubkey: plan.user.publicKey,
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

export function planDeleteNode(plan: Plan, nodeID: LongID): Plan {
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
  const userDB = plan.knowledgeDBs.get(plan.user.publicKey, newDB());
  // filter previous events for views
  const publishEvents = plan.publishEvents.filterNot(
    (event) => event.kind === KIND_VIEWS
  );
  const writeViewEvent = finalizeEvent(
    {
      kind: KIND_VIEWS,
      pubkey: plan.user.publicKey,
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
  activeWorkspace: LongID
): Plan {
  const userDB = plan.knowledgeDBs.get(plan.user.publicKey, newDB());
  const serialized = {
    w: workspaces.toArray(),
    a: activeWorkspace,
  };
  const writeWorkspacesEvent = finalizeEvent(
    {
      kind: KIND_WORKSPACES,
      pubkey: getPublicKey(plan.user.privateKey),
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
  relationTypes: RelationTypes
): Plan {
  const userDB = plan.knowledgeDBs.get(plan.user.publicKey, newDB());
  const serialized = relationTypesToJson(relationTypes);
  const writeRelationsEvent = finalizeEvent(
    {
      kind: KIND_RELATION_TYPES,
      pubkey: getPublicKey(plan.user.privateKey),
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
