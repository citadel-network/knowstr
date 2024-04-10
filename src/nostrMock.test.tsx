import { Map } from "immutable";
import {
  Event,
  Filter,
  SimplePool,
  SubCloser,
  SubscribeManyParams,
  Subscription,
  matchFilters,
} from "nostr-tools";
import { v4 } from "uuid";

export type MockRelayPool = SimplePool & {
  getEvents: () => Array<Event>;
};

function fireEose(sub: Subscription): Promise<void> {
  return Promise.resolve(sub.oneose?.());
}

function fireEvent(sub: Subscription, event: Event): Promise<void> {
  return Promise.resolve(sub.onevent?.(event));
}

async function broadcastEvent(
  subs: Map<string, Subscription>,
  event: Event
): Promise<void> {
  const filtered = subs.filter((sub) => matchFilters(sub.filters, event));
  await Promise.all(
    filtered.toList().map(async (sub) => {
      await fireEvent(sub, event);
      await fireEose(sub);
    })
  );
}

async function broadcastEvents(
  subs: Map<string, Subscription>,
  events: Array<Event>
): Promise<string> {
  await Promise.all(
    events.map(async (event) => {
      await broadcastEvent(subs, event);
    })
  );
  return "";
}

export function mockRelayPool(): MockRelayPool {
  // eslint-disable-next-line functional/no-let
  let subs = Map<string, Subscription>();
  const events: Array<Event> = [];

  return {
    subscribeMany: (
      relays: string[],
      filters: Filter[],
      params: SubscribeManyParams
    ): SubCloser => {
      const id = v4();
      const subscription = {
        id,
        filters,
        ...params,
      } as Subscription;
      subs = subs.set(id, subscription);
      (async () => {
        await broadcastEvents(
          Map<string, Subscription>({ [id]: subscription }),
          events
        );
        fireEose(subscription);
      })();

      return {
        close: () => subs.remove(id),
      };
    },
    publish: (relays: string[], event: Event): Promise<string>[] => {
      // eslint-disable-next-line functional/immutable-data
      events.push(event);
      return relays.map(() => broadcastEvents(subs, [event]));
    },
    getEvents: () => events,
  } as unknown as MockRelayPool;
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
test.skip("skip", () => {});
