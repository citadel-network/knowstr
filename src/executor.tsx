import { bytesToHex } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";
import { schnorr } from "@noble/curves/secp256k1";
import { Event, UnsignedEvent, SimplePool, serializeEvent } from "nostr-tools";
import { List } from "immutable";
import { Plan } from "./planner";

function finalizeEvent(
  event: UnsignedEvent,
  privateKey: Uint8Array,
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

export function finalizeEvents(
  events: List<UnsignedEvent>,
  user: KeyPair
): List<Event> {
  return events.map((e) => finalizeEvent(e, user.privateKey));
}

async function publishEvent(
  relayPool: SimplePool,
  event: Event,
  writeToRelays: Relays
): Promise<void> {
  const writeRelayUrls = writeToRelays.map((r) => r.url);

  if (writeRelayUrls.length === 0) {
    throw new Error("No relays to publish on");
  }
  const results = await Promise.allSettled(
    relayPool.publish(writeRelayUrls, event)
  );
  // If one message can be sent publish is a success,
  // otherwise it's a failure
  const failures = results.filter((res) => res.status === "rejected");
  if (failures.length === writeRelayUrls.length) {
    // Reject only when all have failed
    // eslint-disable-next-line no-console
    failures.map((failure) => console.error(failure, event));
    throw new Error(
      `Failed to publish on: ${failures
        .map((failure) => failure.status)
        .join(".")}`
    );
  }
}

export async function publishEvents(
  relayPool: SimplePool,
  events: List<Event>,
  writeRelays: Relays
): Promise<void> {
  await Promise.all(
    events.toArray().map((event) => publishEvent(relayPool, event, writeRelays))
  );
}

export async function execute({
  plan,
  relayPool,
  relays,
}: {
  plan: Plan;
  relayPool: SimplePool;
  relays: Relays;
}): Promise<void> {
  if (plan.publishEvents.size === 0) {
    // eslint-disable-next-line no-console
    console.warn("Won't execute Noop plan");
    return;
  }
  const finalizedEvents = finalizeEvents(plan.publishEvents, plan.user);
  await publishEvents(relayPool, finalizedEvents, relays);
}
