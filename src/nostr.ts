import { bytesToHex } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";
import { schnorr } from "@noble/curves/secp256k1";
import crypto from "crypto";
import { Event, UnsignedEvent, SimplePool, serializeEvent } from "nostr-tools";

export const KIND_SETTINGS = 11071;
export const KIND_REPUTATIONS = 11080;

export const KIND_KNOWLEDGE = 7871;

export const KIND_VIEWS = 11090;

export const KIND_KNOWLEDGE_LIST = 34750;

export const KIND_RELAY_METADATA_EVENT = 10002;

export const DEFAULT_RELAYS: Relays = [
  { url: "wss://relay.damus.io", read: true, write: true },
  { url: "wss://relay.snort.social", read: true, write: true },
  { url: "wss://nos.lol", read: true, write: true },
  { url: "wss://nostr.wine", read: true, write: true },
];

// eslint-disable-next-line functional/no-let
let lastPublished = 0;

export async function publishEvent(
  relayPool: SimplePool,
  event: Event,
  writeToRelays: Relays
): Promise<void> {
  const writeRelayUrls = writeToRelays.map((r) => r.url);

  if (writeRelayUrls.length === 0) {
    throw new Error(`No relays to publish on`);
  }
  const modifiedDateEvent =
    event.created_at <= lastPublished
      ? {
          ...event,
          // Increase timestamp by one to make sure it's newer
          created_at: lastPublished + 1,
        }
      : event;
  if (modifiedDateEvent.created_at > lastPublished) {
    lastPublished = modifiedDateEvent.created_at;
  }
  const results = await Promise.allSettled(
    relayPool.publish(writeRelayUrls, modifiedDateEvent)
  );
  // If one message can be sent publish is a success,
  // otherwise it's a failure
  const failures = results.filter((res) => res.status === "rejected");
  if (failures.length === writeRelayUrls.length) {
    // Reject only when all have failed
    throw new Error(`Failed to publish on: ${failures.join(".")}`);
  }
}

export function finalizeEvent<T extends number>(
  event: UnsignedEvent<T>,
  privateKey: string,
  oldID?: string
): Event {
  const eventHash = sha256(
    new Uint8Array(Buffer.from(serializeEvent(event), "utf8"))
  );

  const id = oldID || bytesToHex(eventHash);
  const sig = bytesToHex(schnorr.sign(eventHash, privateKey));
  return {
    ...event,
    id,
    sig,
  };
}

export function publishSettings(
  relayPool: SimplePool,
  user: KeyPair,
  settings: Settings,
  writeToRelays: Relays
): Promise<void> {
  const compressedSettings: CompressedSettings = {
    b: settings.bionicReading,
    v: "v1",
    n: crypto.randomBytes(8),
  };
  const content = JSON.stringify(compressedSettings);
  const unsingedEvent = {
    kind: KIND_SETTINGS,
    pubkey: user.publicKey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content,
  };
  const finalizedEvent = finalizeEvent(unsingedEvent, user.privateKey);
  return publishEvent(relayPool, finalizedEvent, writeToRelays);
}

export async function publishRelayMetadata(
  relayPool: SimplePool,
  user: KeyPair,
  relays: Relays,
  writeRelays: Relays
): Promise<void> {
  const tags = relays.map((r) => {
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
  const unsingedEvent = {
    kind: KIND_RELAY_METADATA_EVENT,
    pubkey: user.publicKey,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: "",
  };
  const finalizedEvent = finalizeEvent(unsingedEvent, user.privateKey);
  return publishEvent(relayPool, finalizedEvent, writeRelays);
}
