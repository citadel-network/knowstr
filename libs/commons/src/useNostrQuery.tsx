import { useEffect, useState, useRef } from "react";
import { Event, EventTemplate, Filter, SimplePool } from "nostr-tools";
import { Collection, List, Map, OrderedMap } from "immutable";
import { KIND_RELAY_METADATA_EVENT } from "./nostr";

export type EventQueryResult = {
  events: OrderedMap<string, Event>;
  eose: boolean;
};

export type EventQueryProps = {
  enabled?: boolean;
  readFromRelays?: Array<Relay>;
  discardOld?: boolean;
  filter?: (event: Event) => boolean;
};

const DEFAULTS: EventQueryProps = {
  enabled: true,
  readFromRelays: [],
  discardOld: false,
};

export function findAllTags(
  event: EventTemplate,
  tag: string
): Array<Array<string>> | undefined {
  const filtered = event.tags.filter(([tagName]) => tagName === tag);
  if (filtered.length === 0) {
    return undefined;
  }
  return filtered.map((t) => t.slice(1));
}

export function findTag(event: EventTemplate, tag: string): string | undefined {
  const allTags = findAllTags(event, tag);
  return allTags && allTags[0] && allTags[0][0];
}

export function sortEvents<T extends EventTemplate>(events: List<T>): List<T> {
  return events.sortBy((event, index) =>
    parseFloat(`${event.created_at}.${index}`)
  );
}

export function sortEventsDescending<T extends EventTemplate>(
  events: List<T>
): List<T> {
  return events.sortBy(
    (event, index) => [event.created_at, index],
    (a, b) => {
      if (a[0] !== b[0]) {
        return a[0] < b[0] ? 1 : -1;
      }
      if (a[0] === b[0]) {
        return a[1] < b[1] ? 1 : -1;
      }
      return 0;
    }
  );
}

export function getMostRecentReplacableEvent<T extends EventTemplate>(
  events: Collection<string, T> | List<T>
): T | undefined {
  const listOfEvents = List.isList(events) ? events : events.toList();
  return sortEventsDescending(listOfEvents).first(undefined);
}

export function useEventQuery(
  relayPool: SimplePool,
  filters: Filter[],
  opts?: EventQueryProps
): EventQueryResult {
  const [events, setEvents] = useState<Map<string, Event>>(
    OrderedMap<string, Event>()
  );
  const [eose, setEose] = useState<boolean>(false);

  const componentIsMounted = useRef(true);
  useEffect(() => {
    return () => {
      // eslint-disable-next-line functional/immutable-data
      componentIsMounted.current = false;
    };
  }, []);
  const options = { ...DEFAULTS, ...opts } as {
    enabled: boolean;
    readFromRelays: Array<Relay>;
    discardOld: boolean;
    filter?: (event: Event) => boolean;
  };
  const { enabled } = options;
  const relayUrls = options.readFromRelays.map((r) => r.url);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return () => {};
    }
    const sub = relayPool.subscribeMany(relayUrls, filters, {
      onevent(event: Event): void {
        if (!componentIsMounted.current) {
          return;
        }
        setEvents((existingEvents) => {
          if (
            existingEvents.has(event.id) ||
            (options.filter && !options.filter(event))
          ) {
            return existingEvents;
          }
          return existingEvents.set(event.id, event);
        });
      },
      oneose() {
        if (componentIsMounted.current && !eose) {
          setEose(true);
        }
      },
    });
    return () => {
      sub.close();
      if (options.discardOld) {
        setEose(false);
        setEvents(OrderedMap<string, Event>());
      }
    };
  }, [
    enabled,
    JSON.stringify(relayUrls),
    JSON.stringify(filters),
    componentIsMounted.current,
  ]);
  return {
    events,
    eose,
  };
}

export function findAllRelays(event: EventTemplate): Array<Relay> {
  const relayTags = findAllTags(event, "r");
  if (!relayTags) {
    return [];
  }
  return relayTags
    .filter((tag) => tag.length >= 1)
    .map((tag) => {
      const { length } = tag;
      const url = tag[0];
      if (length === 1) {
        return {
          url,
          read: true,
          write: true,
        };
      }
      const read =
        (length >= 2 && tag[1] === "read") ||
        (length >= 3 && tag[2] === "read");
      const write =
        (length >= 2 && tag[1] === "write") ||
        (length >= 3 && tag[2] === "write");
      return {
        url,
        read,
        write,
      };
    });
}

export function createRelaysQuery(nostrPublicKeys: Array<string>): Filter {
  return {
    kinds: [KIND_RELAY_METADATA_EVENT],
    authors: nostrPublicKeys,
  };
}

export function useRelaysQuery(
  simplePool: SimplePool,
  authors: Array<string>,
  enabled: boolean,
  startingRelays: Array<Relay>
): {
  relays: Array<Relay>;
  eose: boolean;
} {
  const { events, eose } = useEventQuery(
    simplePool,
    [createRelaysQuery(authors)],
    {
      enabled,
      readFromRelays: startingRelays,
    }
  );

  if (!eose) {
    return { relays: startingRelays, eose };
  }
  const newestEvent = getMostRecentReplacableEvent(events);

  if (newestEvent) {
    return { relays: findAllRelays(newestEvent), eose };
  }
  return { relays: startingRelays, eose };
}
