import { Event, SimplePool } from "nostr-tools";
import { List } from "immutable";
import { getMostRecentReplacableEvent } from "citadel-commons";
import { Plan } from "./planner";
import {
  KIND_KNOWLEDGE,
  KIND_RELAY_METADATA_EVENT,
  KIND_REPUTATIONS,
  KIND_SETTINGS,
  finalizeEvent,
  publishEvent,
} from "./nostr";

async function publishEvents(
  relayPool: SimplePool,
  events: List<Event>,
  writeRelays: Relays
): Promise<void> {
  await Promise.all(
    events.toArray().map((event) => publishEvent(relayPool, event, writeRelays))
  );
}

function getLastEventByKind(
  events: List<Event>,
  kind: number
): Event | undefined {
  const kindEvents = events.filter((e: Event) => e.kind === kind);
  return getMostRecentReplacableEvent(kindEvents);
}

function signEventWithNewDate(event: Event, user: KeyPair): Event {
  const eventWithNewDate = {
    kind: event.kind,
    pubkey: event.pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: event.tags,
    content: event.content,
  };
  return finalizeEvent(eventWithNewDate, user.privateKey, event.id);
}

function signEventsWithNewDate(
  events: List<Event | undefined>,
  user: KeyPair
): List<Event> {
  return events.reduce((rdx, ev) => {
    if (ev !== undefined) {
      return rdx.push(signEventWithNewDate(ev, user));
    }
    return rdx;
  }, List<Event>([]));
}

export async function republishEvents(
  relayPool: SimplePool,
  events: List<Event>,
  writeRelays: Relays,
  user: KeyPair
): Promise<void> {
  const lastReplacableEvents = List([
    getLastEventByKind(events, KIND_SETTINGS),
    getLastEventByKind(events, KIND_REPUTATIONS),
    getLastEventByKind(events, KIND_RELAY_METADATA_EVENT),
  ]);
  const allMyKnowledgeEvents = events.filter(
    (e: Event) => e.kind === KIND_KNOWLEDGE
  );

  const eventsToRepublish = signEventsWithNewDate(
    lastReplacableEvents.concat(allMyKnowledgeEvents),
    user
  );
  await publishEvents(relayPool, eventsToRepublish, writeRelays);
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
