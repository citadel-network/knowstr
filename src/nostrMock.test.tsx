import { Map } from "immutable";
import { Event, Filter, SimplePool, Sub, matchFilters } from "nostr-tools";
import { v4 } from "uuid";

export type MockRelayPool = SimplePool & {
  getEvents: () => Array<Event>;
};

type Callback = (event?: Event) => void | Promise<void>;

type EventListener = {
  callback: Callback;
  eventName: string;
};

type SubMock = {
  id: string;
  filters: Filter[];
  eventListeners: EventListener[];
};

function fireEose(sub: SubMock): void {
  sub.eventListeners.forEach((eventListener) => {
    if (eventListener.eventName === "eose") {
      eventListener.callback();
    }
  });
}

async function fireEventListeners(
  eventListeners: EventListener[],
  event: Event
): Promise<void> {
  const filtered = eventListeners.filter((ev) => ev.eventName === "event");
  await Promise.all(
    filtered.map(async (eventListener) => {
      await eventListener.callback(event);
    })
  );
}

async function fireAllSubs(
  subs: Map<string, SubMock>,
  event: Event
): Promise<void> {
  const filtered = subs.filter((sub) => matchFilters(sub.filters, event));
  await Promise.all(
    filtered.toList().map(async (sub) => {
      await fireEventListeners(sub.eventListeners, event);
    })
  );
}

async function fireEvents(
  subs: Map<string, SubMock>,
  events: Array<Event>
): Promise<void> {
  await Promise.all(
    events.map(async (event) => {
      await fireAllSubs(subs, event);
    })
  );
}

export function mockRelayPool(): MockRelayPool {
  // eslint-disable-next-line functional/no-let
  let subs = Map<string, SubMock>();
  const events: Array<Event> = [];

  const addEventListener = (
    id: string,
    filters: Filter[],
    eventListener: EventListener
  ): void => {
    const existing = subs.get(id, {
      filters,
      id,
      eventListeners: [],
    });
    subs = subs.set(id, {
      ...existing,
      eventListeners: [...existing.eventListeners, eventListener],
    });
  };

  return {
    sub: (relays: string[], filters: Filter[]): Sub => {
      const id = v4();
      return {
        on: (eventName: string, callback: Callback) => {
          addEventListener(id, filters, { callback, eventName });
          if (eventName === "event") {
            (async () => {
              await fireEvents(
                Map<string, SubMock>({
                  [id]: {
                    id,
                    filters,
                    eventListeners: [
                      {
                        callback,
                        eventName,
                      },
                    ],
                  },
                }),
                events
              );
              const sub = subs.get(id);
              if (sub && eventName === "event") {
                // After sending all stored events fire eose
                fireEose(sub);
              }
            })();
          }
        },
        unsub: () => {
          subs = subs.remove(id);
        },
      } as Sub;
    },
    publish: (relays: string[], event: Event<number>): Promise<void>[] => {
      // eslint-disable-next-line functional/immutable-data
      events.push(event);
      return [fireEvents(subs, [event])];
    },
    getEvents: () => events,
  } as MockRelayPool;
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
test.skip("skip", () => {});
