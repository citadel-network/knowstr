import { useEffect, useRef, useState } from "react";
import { Map, OrderedMap } from "immutable";
import { SimplePool, Filter, Event, SubCloser } from "nostr-tools";
import { EventQueryResult, EventQueryProps } from "./useNostrQuery";

export type GroupedByAuthorFilter = Omit<Filter, "authors">;

function createSubs(
  relayPool: SimplePool,
  relayUrls: string[],
  authors: string[],
  filters: GroupedByAuthorFilter[],
  setEvents: (
    updater: (
      existingEvents: Map<string, OrderedMap<string, Event>>
    ) => Map<string, OrderedMap<string, Event>>
  ) => void,
  setEose: (
    updater: (existingEose: Map<string, boolean>) => Map<string, boolean>
  ) => void
): Map<string, SubCloser> {
  return Map<string, SubCloser>(
    authors.map((author) => {
      const filtersWithAuthor = filters.map((filter) => ({
        ...filter,
        authors: [author],
      }));
      const sub = relayPool.subscribeMany(relayUrls, filtersWithAuthor, {
        onevent(event: Event): void {
          setEvents((existingEventsByAuthor) => {
            const existingEvents = existingEventsByAuthor.get(
              author,
              OrderedMap<string, Event>()
            );
            if (existingEvents.has(event.id)) {
              return existingEventsByAuthor;
            }
            return existingEventsByAuthor.set(
              author,
              existingEvents.set(event.id, event)
            );
          });
        },
        oneose() {
          setEose((current) => {
            if (current.get(author)) {
              return current;
            }
            return current.set(author, true);
          });
        },
      });
      return [author, sub];
    })
  );
}

function unsubAll(subs: Map<string, SubCloser>): void {
  subs.map((sub) => sub.close());
}

export function useEventQueryByAuthor(
  relayPool: SimplePool,
  filters: GroupedByAuthorFilter[],
  authors: string[],
  opts?: EventQueryProps
): Map<string, EventQueryResult> {
  // TODO: a simple implementaiton would be to just store a List and separate it later
  const [events, setEvents] = useState<Map<string, OrderedMap<string, Event>>>(
    Map<string, OrderedMap<string, Event>>()
  );
  const [eose, setEose] = useState<Map<string, boolean>>(
    Map<string, boolean>()
  );
  const queries = useRef<Map<string, SubCloser>>(Map<string, SubCloser>());

  const enabled = !(opts && opts.enabled === false);
  const relayUrls =
    opts && opts.readFromRelays ? opts.readFromRelays.map((r) => r.url) : [];

  useEffect(() => {
    if (!enabled) {
      return;
    }
    // TODO: don't create a query per author, create a query for all available authors
    const startQueriesFor = authors.filter(
      (author) => !queries.current.has(author)
    );
    if (startQueriesFor.length === 0) {
      return;
    }
    const newSubs = createSubs(
      relayPool,
      relayUrls,
      startQueriesFor,
      filters,
      setEvents,
      setEose
    );
    // eslint-disable-next-line functional/immutable-data
    queries.current = queries.current.merge(newSubs);
  }, [authors]); // start non existing queries

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return () => {};
    }
    const startQueriesFor = authors.filter(
      (author) => !queries.current.has(author)
    );
    if (startQueriesFor.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return () => {};
    }
    const newSubs = createSubs(
      relayPool,
      relayUrls,
      startQueriesFor,
      filters,
      setEvents,
      setEose
    );
    // eslint-disable-next-line functional/immutable-data
    queries.current = queries.current.merge(newSubs);
    return () => {
      unsubAll(queries.current);
      // eslint-disable-next-line functional/immutable-data
      queries.current = Map<string, SubCloser>();
    };
  }, [enabled, relayUrls]);

  return events.map((userEvents, author) => ({
    eose: eose.get(author, false),
    events: userEvents,
  }));
}
