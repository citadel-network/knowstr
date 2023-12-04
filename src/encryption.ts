import crypto from "crypto";
import memoize from "memoizee";
import { Map } from "immutable";
import { matchFilter } from "nostr-tools";
import { findTag } from "citadel-commons";
import { Serializable } from "./serializer";

import { Plan } from "./planner";

import { finalizeEvent, KEY_DISTR_EVENT } from "./nostr";
import { createSendBroadcastKeyEvent } from "./broadcastKeys";

type SignedPayload = {
  signature: string;
  payload: Serializable;
};

const createPayloadEncryptionKey =
  function createPayloadEncryptionKey(): Buffer {
    return crypto.randomBytes(32);
  };

function encryptSymmetric(
  payload: Serializable,
  encryptionKey: Buffer
): SymmetricEncryptedText {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", encryptionKey, iv);
  const cipherText =
    cipher.update(JSON.stringify({ payload }), "utf8", "hex") +
    cipher.final("hex");
  return {
    iv,
    cipherText,
  };
}

const hashContent = memoize(function createContentHash(
  contentString: string
): string {
  return crypto
    .createHash("sha256")
    .update(Buffer.from(contentString))
    .digest("hex");
});

function verifyContentHash(content: string, hash: string): boolean {
  const contentHash = hashContent(content);
  return contentHash === hash;
}

function decryptAES(iv: string, cipherText: string, key: string): Serializable {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(key, "hex"),
    Buffer.from(iv, "hex")
  );
  const decrypted =
    decipher.update(cipherText, "hex", "utf8") + decipher.final("utf8");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  const { payload } = JSON.parse(decrypted) as SignedPayload;
  return payload;
}

type SymmetricDecryptProps = {
  encryptionKey: Buffer;
  decryptSymmetric: DecryptSymmetric;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export function symmetricDecryptPayload<T extends object>({
  encryptionKey,
  decryptSymmetric: decrypt,
  payload,
}: SymmetricDecryptProps & { payload: string }): T | undefined {
  try {
    const encryptedContent = JSON.parse(payload) as SymmetricEncryptedText;
    const decrypted = decrypt(
      Buffer.from(encryptedContent.iv).toString("hex"),
      encryptedContent.cipherText,
      encryptionKey.toString("hex")
    );
    if (!decrypted) {
      return undefined;
    }
    return decrypted as T;
  } catch {
    return undefined;
  }
}

function defaultKeyDistribution({
  plan,
}: {
  plan: Omit<Plan, "broadcastKey"> & {
    broadcastKey?: Buffer;
  };
}): Map<string, HasPublicKey> {
  return Map<string, HasPublicKey>(plan.contacts)
    .set(plan.user.publicKey, plan.user)
    .merge(plan.contactsOfContacts);
}

export async function planKeyDistribution(plan: Plan): Promise<Plan> {
  const forUsers = defaultKeyDistribution({
    plan,
  });
  const alreadyDistributed = plan.sentEvents
    .merge(plan.publishEvents)
    .filter((event) =>
      matchFilter(
        {
          kinds: [KEY_DISTR_EVENT],
        },
        event
      )
    )
    .map((event) => findTag(event, "p"));

  const distr = forUsers.filterNot((user) =>
    alreadyDistributed.contains(user.publicKey)
  );

  const events = await Promise.all(
    distr
      .toList()
      .toArray()
      .map(async (user) =>
        finalizeEvent(
          await createSendBroadcastKeyEvent({
            from: plan.user.privateKey,
            to: user.publicKey,
            broadcastKey: plan.broadcastKey,
          }),
          plan.user.privateKey
        )
      )
  );

  return {
    ...plan,
    publishEvents: plan.publishEvents.merge(events),
  };
}

export async function createRefereeKeyDistributionPlan(
  plan: Plan,
  newUser: Contact
): Promise<Plan> {
  const { broadcastKeys } = plan;
  return plan.contacts
    .set(plan.user.publicKey, plan.user)
    .toList()
    .reduce(async (context, user) => {
      const rdx = await context;
      const broadcastKey = broadcastKeys.get(user.publicKey);
      if (!broadcastKey) {
        return rdx;
      }
      const event = await createSendBroadcastKeyEvent({
        from: plan.user.privateKey,
        to: newUser.publicKey,
        broadcastKey,
        issuer: user.publicKey,
      });
      return {
        ...rdx,
        publishEvents: rdx.publishEvents.push(
          finalizeEvent(event, plan.user.privateKey)
        ),
      };
    }, Promise.resolve(plan));
}

export function createEncryption(): Encryption {
  return {
    encryptSymmetric,
    decryptSymmetric: memoize(decryptAES),
  };
}

export { createPayloadEncryptionKey, verifyContentHash, hashContent };
