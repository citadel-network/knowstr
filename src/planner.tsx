import { Map, List } from "immutable";
import { Event, getPublicKey } from "nostr-tools";
import { useData } from "./DataContext";
import { execute } from "./executor";

import {
  planKeyDistribution,
  createRefereeKeyDistributionPlan,
  createPayloadEncryptionKey,
} from "./encryption";
import { useApis } from "./Apis";
import { Serializable, diffToJSON } from "./serializer";
import { KIND_KNOWLEDGE, KIND_REPUTATIONS, finalizeEvent } from "./nostr";
import { KnowledgeDiff, RepoDiff } from "./knowledgeEvents";

export type Plan = Data & {
  broadcastKey: Buffer;
  publishEvents: List<Event>;
  encryption: Encryption;
};

type Planner = {
  createPlan: () => Plan;
  executePlan: (plan: Plan) => Promise<void>;
};

export function createPlan(
  props: Data & {
    broadcastKey?: Buffer;
    encryption: Encryption;
    publishEvents?: List<Event>;
  }
): Plan {
  const myBroadcastKey = props.broadcastKeys.get(props.user.publicKey);
  const encryptionKey =
    myBroadcastKey || props.broadcastKey || createPayloadEncryptionKey();
  return {
    ...props,
    broadcastKey: encryptionKey,
    publishEvents: props.publishEvents || List<Event>([]),
  };
}

export function usePlanner(): Planner {
  const data = useData();
  const { encryption, relayPool } = useApis();
  const createPlanningContext = (): Plan => {
    return createPlan({
      ...data,
      encryption,
      broadcastKey: data.broadcastKeys.get(data.user.publicKey),
    });
  };
  const writeRelays = data.relays.filter((r) => r.write === true);
  const executePlan = async (plan: Plan): Promise<void> => {
    return execute({
      plan,
      relayPool,
      relays: writeRelays,
    });
  };
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
  knowledgeDiff: KnowledgeDiff<BranchWithCommits>,
  isBootstrapDiff?: boolean | undefined
): Plan {
  const events = splitDiff(knowledgeDiff, plan.user.publicKey).map((diff) => {
    const encryptedData = plan.encryption.encryptSymmetric(
      diffToJSON(diff, plan.user.publicKey),
      plan.broadcastKey
    );
    return finalizeEvent(
      {
        kind: KIND_KNOWLEDGE,
        pubkey: getPublicKey(plan.user.privateKey),
        created_at: Math.floor(Date.now() / 1000),
        tags: isBootstrapDiff ? [["bootstrap"]] : [],
        content: JSON.stringify(encryptedData),
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
  const encryptedContacts = plan.encryption.encryptSymmetric(
    contactsMap.toJSON(),
    plan.broadcastKey
  );
  const event = finalizeEvent(
    {
      kind: KIND_REPUTATIONS,
      pubkey: getPublicKey(context.user.privateKey),
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(encryptedContacts),
    },
    plan.user.privateKey
  );
  return {
    ...plan,
    publishEvents: plan.publishEvents.push(event),
  };
}

async function planUpsertContact(
  context: Plan,
  privateContact: Contact
): Promise<Plan> {
  const planWithContact = planSetContact(context, privateContact);
  return createRefereeKeyDistributionPlan(
    // Distribute Key again, in case there are new contacts
    await planKeyDistribution(planWithContact),
    privateContact
  );
}

export function planEnsurePrivateContact(
  context: Plan,
  publicKey: PublicKey
): Promise<Plan> {
  return context.contacts.has(publicKey)
    ? Promise.resolve(context)
    : planUpsertContact(context, {
        publicKey,
        createdAt: new Date(),
      });
}
