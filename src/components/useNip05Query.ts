import { Map } from "immutable";
import { Filter, SimplePool, Event } from "nostr-tools";
import { KIND_NIP05, useEventQuery } from "citadel-commons";

function createNip05Query(publicKey: PublicKey): Filter {
  return {
    kinds: [KIND_NIP05],
    authors: [publicKey],
  };
}

export function useNip05Query(
  simplePool: SimplePool,
  author: PublicKey,
  relays: Array<Relay>
): {
  events: Map<string, Event>;
  eose: boolean;
} {
  const { events, eose } = useEventQuery(
    simplePool,
    [createNip05Query(author)],
    {
      readFromRelays: relays,
    }
  );
  return { events, eose };
}
