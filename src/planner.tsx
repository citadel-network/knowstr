import React from "react";
import { Map, List } from "immutable";
import { Event, getPublicKey } from "nostr-tools";
import { nodeModuleNameResolver } from "typescript";
import { useData } from "./DataContext";
import { execute } from "./executor";

import { useApis } from "./Apis";
import {
  Serializable,
  diffToJSON,
  relationsToJSON,
  viewsToJSON,
} from "./serializer";
import {
  KIND_DELETE,
  KIND_KNOWLEDGE,
  KIND_KNOWLEDGE_LIST,
  KIND_KNOWLEDGE_NODE,
  KIND_REPUTATIONS,
  KIND_VIEWS,
  KIND_WORKSPACES,
  finalizeEvent,
} from "./nostr";
import { KnowledgeDiff, RepoDiff } from "./knowledgeEvents";
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

const CHUNK_SIZE_CHARS = 32000;

// Splits diff into chunks of max 'chunkSizeChars'. If a Repo exceeds the chunkSizeChars a diff might come out bigger.
export function splitDiff(
  diff: KnowledgeDiff<BranchWithCommits>,
  myself: PublicKey,
  chunkSizeChars: number = CHUNK_SIZE_CHARS
): List<KnowledgeDiff<BranchWithCommits>> {
  if (!diff.repos) {
    return List([diff]);
  }
  return diff.repos.reduce(
    (diffs, repoDiff, id) => {
      const last = diffs.last(undefined) as KnowledgeDiff<BranchWithCommits>;
      const withRepo = {
        ...last,
        repos: (last.repos
          ? last.repos
          : Map<string, RepoDiff<BranchWithCommits>>()
        ).set(id, repoDiff),
      };
      const lastDiffIsEmpty =
        last.activeWorkspace === undefined &&
        last.views === undefined &&
        last.repos === undefined;
      if (
        JSON.stringify(diffToJSON(withRepo, myself)).length <= chunkSizeChars ||
        lastDiffIsEmpty
      ) {
        return diffs.set(diffs.size - 1, withRepo);
      }
      return diffs.push({
        repos: Map<RepoDiff<BranchWithCommits> | null>({ [id]: repoDiff }),
      });
    },
    List<KnowledgeDiff<BranchWithCommits>>([
      {
        activeWorkspace: diff.activeWorkspace,
        views: diff.views,
      },
    ])
  );
}

export function planSetKnowledgeData(
  plan: Plan,
  knowledgeDiff: KnowledgeDiff<BranchWithCommits>
): Plan {
  const events = splitDiff(knowledgeDiff, plan.user.publicKey).map((diff) => {
    return finalizeEvent(
      {
        kind: KIND_KNOWLEDGE,
        pubkey: getPublicKey(plan.user.privateKey),
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify(diffToJSON(diff, plan.user.publicKey)),
      },
      plan.user.privateKey
    );
  });
  return {
    ...plan,
    publishEvents: plan.publishEvents.concat(events),
  };
}

function planSetContact(context: Plan, privateContact: Contact): Plan {
  const plan = {
    ...context,
    contacts: context.contacts.set(privateContact.publicKey, privateContact),
  };
  const contactsMap = plan.contacts.map(
    // TODO: write a test to ensure that honourBet, honour and eosAccountName will be preserved
    (contact): Serializable => {
      // Write this explicit, so we don't accidentally expose private data
      return {
        ...contact,
        createdAt: contact.createdAt ? contact.createdAt.getTime() : 0,
        // Delete Private Key explicitly
        privateKey: undefined,
        commonContact: undefined,
      };
    }
  );
  const event = finalizeEvent(
    {
      kind: KIND_REPUTATIONS,
      pubkey: getPublicKey(context.user.privateKey),
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(contactsMap.toJSON()),
    },
    plan.user.privateKey
  );
  return {
    ...plan,
    publishEvents: plan.publishEvents.push(event),
  };
}

export function planEnsurePrivateContact(
  context: Plan,
  publicKey: PublicKey
): Plan {
  return context.contacts.has(publicKey)
    ? context
    : planSetContact(context, {
        publicKey,
        createdAt: new Date(),
      });
}

export function planUpsertRelations(plan: Plan, relations: Relations): Plan {
  const userDB = plan.knowledgeDBs.get(plan.user.publicKey, newDB());
  const updatedRelations = userDB.relations.set(relations.id, relations);
  const updatedDB = {
    ...userDB,
    relations: updatedRelations,
  };
  const updateRelationsEvent = finalizeEvent(
    {
      kind: KIND_KNOWLEDGE_LIST,
      pubkey: plan.user.publicKey,
      created_at: Math.floor(Date.now() / 1000),
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
      created_at: Math.floor(Date.now() / 1000),
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

export function planDeleteNode(plan: Plan, nodeID: LongID): Plan {
  const deleteEvent = finalizeEvent(
    {
      kind: KIND_DELETE,
      pubkey: plan.user.publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        [
          "a",
          `${KIND_KNOWLEDGE_NODE}:${plan.user.publicKey}:${shortID(nodeID)}`,
        ],
      ],
      content: "",
    },
    plan.user.privateKey
  );
  const userDB = plan.knowledgeDBs.get(plan.user.publicKey, newDB());
  const updatedNodes = userDB.nodes.remove(shortID(nodeID));
  const updatedDB = {
    ...userDB,
    nodes: updatedNodes,
  };
  return {
    ...plan,
    knowledgeDBs: plan.knowledgeDBs.set(plan.user.publicKey, updatedDB),
    publishEvents: plan.publishEvents.push(deleteEvent),
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
      created_at: Math.floor(Date.now() / 1000),
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
      created_at: Math.floor(Date.now() / 1000),
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
