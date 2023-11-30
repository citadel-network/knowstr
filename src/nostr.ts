import { bytesToHex } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";
import { schnorr } from "@noble/curves/secp256k1";
import crypto from "crypto";
import {
  Event,
  UnsignedEvent,
  SimplePool,
  serializeEvent,
  nip04,
  getPublicKey,
} from "nostr-tools";
import { Collection, List } from "immutable";

export const KIND_SETTINGS = 11071;
export const KIND_REPUTATIONS = 11080;

export const KIND_KNOWLEDGE = 7870;

export const KEY_DISTR_EVENT = 5805;
export const KIND_RELAY_METADATA_EVENT = 10002;

export const DEFAULT_RELAYS: Relays = [
  { url: "wss://relay.damus.io", read: true, write: true },
  { url: "wss://relay.snort.social", read: true, write: true },
  { url: "wss://nos.lol", read: true, write: true },
  { url: "wss://nostr.wine", read: true, write: true },
];

export function sortEvents(events: List<Event>): List<Event> {
  return events.sortBy((event, index) =>
    parseFloat(`${event.created_at}.${index}`)
  );
}

export function sortEventsDescending(events: List<Event>): List<Event> {
  return events.sortBy((event, index) =>
    parseFloat(`${-event.created_at}.${index}`)
  );
}

export function getMostRecentReplacableEvent(
  events: Collection<string, Event> | List<Event>
): Event | undefined {
  const listOfEvents = List.isList(events) ? events : events.toList();
  return sortEventsDescending(listOfEvents).first(undefined);
}

export async function publishEvent(
  relayPool: SimplePool,
  event: Event,
  writeToRelays: Relays
): Promise<void> {
  const writeRelayUrls = writeToRelays.map((r) => r.url);

  if (writeRelayUrls.length === 0) {
    throw new Error(`No relays to publish on`);
  }
  const results = await Promise.allSettled(
    relayPool.publish(writeRelayUrls, event)
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

export function findAllTags(
  event: Event,
  tag: string
): Array<Array<string>> | undefined {
  const filtered = event.tags.filter(([tagName]) => tagName === tag);
  if (filtered.length === 0) {
    return undefined;
  }
  return filtered.map((t) => t.slice(1));
}

export function findTag(event: Event, tag: string): string | undefined {
  const allTags = findAllTags(event, tag);
  return allTags && allTags[0] && allTags[0][0];
}

export async function publishSettings(
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
  const content = await nip04.encrypt(
    user.privateKey,
    getPublicKey(user.privateKey),
    JSON.stringify(compressedSettings)
  );
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
