import { Map, List } from "immutable";
import { Event, getPublicKey, matchFilter, nip04 } from "nostr-tools";
import {
  createPayloadEncryptionKey,
  createEncryption,
  verifyContentHash,
  hashContent,
  planKeyDistribution,
  createRefereeKeyDistributionPlan,
} from "./encryption";
import {
  CAROL_PRIVATE_KEY,
  UNAUTHENTICATED_CAROL,
  UNAUTHENTICATED_BOB,
  ALICE,
  BOB_PRIVATE_KEY,
  CAROL_PUBLIC_KEY,
  BOB,
  extractBroadcastKey,
  EMPTY_PLAN,
} from "./utils.test";
import { Plan, createPlan } from "./planner";
import { KEY_DISTR_EVENT } from "./nostr";
import { tryToDecryptBroadcastKey } from "./broadcastKeys";

function contactsToMap(contacts: Array<Contact>): Contacts {
  return Map<PublicKey, Contact>(
    contacts.map((contact) => [contact.publicKey, contact])
  );
}

function hasKeyForUser(plan: Plan, userPublicKey: string): boolean {
  const filter = {
    tags: ["#p", userPublicKey],
    authors: [getPublicKey(plan.user.privateKey)],
    kinds: [KEY_DISTR_EVENT],
  };
  return (
    plan.publishEvents.filter((event) => matchFilter(filter, event)).size > 0
  );
}

test("payload encryption key can be used to encrypt data", () => {
  const key = createPayloadEncryptionKey();
  const { encryptSymmetric, decryptSymmetric } = createEncryption();

  const cipher = encryptSymmetric({ thisIsEncrypted: true }, key);
  // cipher needs to be serializable
  const serializedCipher = JSON.stringify(cipher);
  const deserializedCipher = JSON.parse(
    serializedCipher
  ) as SymmetricEncryptedText;
  expect(
    decryptSymmetric(
      Buffer.from(deserializedCipher.iv).toString("hex"),
      deserializedCipher.cipherText,
      key.toString("hex")
    )
  ).toEqual({
    thisIsEncrypted: true,
  });
});

it("stores payload encryption keys for multiple users", async () => {
  const plan = await planKeyDistribution({
    ...EMPTY_PLAN,
    contacts: contactsToMap([UNAUTHENTICATED_CAROL, UNAUTHENTICATED_BOB]),
  });
  expect(hasKeyForUser(plan, UNAUTHENTICATED_CAROL.publicKey)).toBeTruthy();
  expect(hasKeyForUser(plan, UNAUTHENTICATED_BOB.publicKey)).toBeTruthy();
  expect(hasKeyForUser(plan, ALICE.publicKey)).toBeTruthy();
});

test("creates new key if user doesn't have one yet", async () => {
  const plan = await planKeyDistribution(
    createPlan({
      ...EMPTY_PLAN,
      contacts: contactsToMap([UNAUTHENTICATED_CAROL, UNAUTHENTICATED_BOB]),
    })
  );
  expect(plan.broadcastKey).not.toBeUndefined();
  expect(hasKeyForUser(plan, UNAUTHENTICATED_CAROL.publicKey)).toBeTruthy();
  expect(hasKeyForUser(plan, UNAUTHENTICATED_BOB.publicKey)).toBeTruthy();
  expect(hasKeyForUser(plan, ALICE.publicKey)).toBeTruthy();

  // TODO: ensure that events are not created twice
});

test("distributes broadcast keys of existing contacts to new contact", async () => {
  const plan = await createRefereeKeyDistributionPlan(
    {
      ...EMPTY_PLAN,
      broadcastKey: Buffer.from("broadcastKey"),
      contacts: contactsToMap([UNAUTHENTICATED_BOB]),
      broadcastKeys: Map<PublicKey, Buffer>({
        [BOB.publicKey]: Buffer.from("bob-broadcast-key"),
        [ALICE.publicKey]: Buffer.from("alice-broadcast-key"),
      }),
    },
    UNAUTHENTICATED_CAROL
  );
  // Alice distributes keys to Carol
  const publishEvents = plan.publishEvents.toArray();
  expect(publishEvents).toEqual([
    expect.objectContaining({
      tags: [["p", CAROL_PUBLIC_KEY]],
      kind: KEY_DISTR_EVENT,
    }),
    expect.objectContaining({
      tags: [["p", CAROL_PUBLIC_KEY]],
      kind: KEY_DISTR_EVENT,
    }),
  ]);
  // Carol can read this keys
  const bobsKey = (await tryToDecryptBroadcastKey(
    publishEvents[0],
    CAROL_PRIVATE_KEY
  )) as [PublicKey, Buffer];
  const aliceKey = (await tryToDecryptBroadcastKey(
    publishEvents[1],
    CAROL_PRIVATE_KEY
  )) as [PublicKey, Buffer];

  expect(bobsKey[1].toString()).toEqual("bob-broadcast-key");
  expect(aliceKey[1].toString()).toEqual("alice-broadcast-key");
});

it("doesn't store a payload encryption key if there is already one for that user", async () => {
  const plan = await planKeyDistribution({
    ...EMPTY_PLAN,
    broadcastKey: Buffer.from("key"),
    contacts: contactsToMap([UNAUTHENTICATED_CAROL, UNAUTHENTICATED_BOB]),
  });
  hasKeyForUser(plan, UNAUTHENTICATED_BOB.publicKey);
  hasKeyForUser(plan, ALICE.publicKey);
  // Distributes key to Bob, Carol and herself
  expect(plan.publishEvents.size).toBe(3);

  const planWithEventsSent = {
    ...plan,
    sentEvents: plan.publishEvents,
    publishEvents: List<Event>(),
  };
  const distributeAgain = await planKeyDistribution({
    ...planWithEventsSent,
    broadcastKey: Buffer.from("key"),
    contacts: contactsToMap([UNAUTHENTICATED_CAROL, UNAUTHENTICATED_BOB]),
  });
  expect(distributeAgain.publishEvents.size).toBe(0);
});

it("distribute existing key to bob", async () => {
  const plan = await planKeyDistribution({
    ...EMPTY_PLAN,
    contacts: contactsToMap([UNAUTHENTICATED_BOB]),
    broadcastKey: Buffer.from("alice-key"),
  });
  expect(
    await extractBroadcastKey(
      plan.publishEvents.toArray(),
      plan.user.publicKey,
      BOB_PRIVATE_KEY
    )
  ).toEqual(Buffer.from("alice-key"));
});

test("test hash verification", () => {
  const aliceSymmetricKey = createPayloadEncryptionKey();
  const { encryptSymmetric } = createEncryption();
  const payloadString = JSON.stringify(
    encryptSymmetric({ i: "am alice" }, aliceSymmetricKey)
  );
  const payloadHash = hashContent(payloadString);
  expect(verifyContentHash(payloadString, payloadHash)).toBeTruthy();
  expect(verifyContentHash(payloadString, `${payloadHash}000`)).toBeFalsy();
});

test("nip04 self encryption", async () => {
  const encrypted = await nip04.encrypt(
    ALICE.privateKey,
    ALICE.publicKey,
    "Hello"
  );
  const decrypted = await nip04.decrypt(
    ALICE.privateKey,
    ALICE.publicKey,
    encrypted
  );
  expect(decrypted).toEqual("Hello");
});
