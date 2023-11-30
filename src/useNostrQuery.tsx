import { useEffect, useState, useRef } from "react";
import { Event, Filter } from "nostr-tools";
import { Map, OrderedMap } from "immutable";
import { useApis } from "./Apis";
import {
  KIND_RELAY_METADATA_EVENT,
  findAllTags,
  getMostRecentReplacableEvent,
} from "./nostr";

type EventQueryResult = {
  events: OrderedMap<string, Event>;
  eose: boolean;
};

type EventQueryProps = {
  enabled?: boolean;
  readFromRelays?: Relays;
};

export function useEventQuery(
  filters: Filter<number>[],
  opts?: EventQueryProps
): EventQueryResult {
  const { relayPool } = useApis();
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

  const enabled = !(opts && opts.enabled === false);
  const relayUrls =
    opts && opts.readFromRelays ? opts.readFromRelays.map((r) => r.url) : [];

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return () => {};
    }
    const sub = relayPool.sub(relayUrls, filters);
    const eventHandler = (event: Event): void => {
      if (!componentIsMounted.current) {
        return;
      }
      setEvents((existingEvents) => {
        if (existingEvents.has(event.id)) {
          return existingEvents;
        }
        return existingEvents.set(event.id, event);
      });
    };

    sub.on("eose", () => {
      if (componentIsMounted.current && !eose) {
        setEose(true);
      }
    });
    sub.on("event", eventHandler);

    return () => {
      sub.unsub();
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

export function findAllRelays(event: Event): Relays {
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

function createRelaysQuery(nostrPublicKeys: Array<PublicKey>): Filter<number> {
  return {
    kinds: [KIND_RELAY_METADATA_EVENT],
    authors: nostrPublicKeys,
  };
}

export function useRelaysQuery(
  authors: Array<PublicKey>,
  enabled: boolean,
  startingRelays: Relays
): {
  relays: Relays;
  eose: boolean;
} {
  const { events, eose } = useEventQuery([createRelaysQuery(authors)], {
    enabled,
    readFromRelays: startingRelays,
  });

  if (!eose) {
    return { relays: startingRelays, eose };
  }
  const newestEvent = getMostRecentReplacableEvent(events);

  if (newestEvent) {
    return { relays: findAllRelays(newestEvent), eose };
  }
  return { relays: startingRelays, eose };
}
