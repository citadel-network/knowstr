import { Event, SimplePool } from "nostr-tools";
import { List } from "immutable";
import { Plan } from "./planner";
import { publishEvent } from "./nostr";

async function publishEvents(
  relayPool: SimplePool,
  events: List<Event>,
  writeRelays: Relays
): Promise<void> {
  await Promise.all(
    events.toArray().map((event) => publishEvent(relayPool, event, writeRelays))
  );
}

export async function republishEvents(
  relayPool: SimplePool,
  events: List<Event>,
  writeRelays: Relays
): Promise<void> {
  await publishEvents(relayPool, events, writeRelays);
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
  await publishEvents(relayPool, plan.publishEvents, relays);
}
