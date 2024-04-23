import { UnsignedEvent } from "nostr-tools";
import {
  findAllRelays,
  getMostRecentReplacableEvent,
  getReadRelays,
  getWriteRelays,
} from "citadel-commons";
import { List, Map } from "immutable";
import { KIND_RELAY_METADATA_EVENT } from "./nostr";
import { sanitizeRelays } from "./components/EditRelays";

export function findRelays(events: List<UnsignedEvent>): Relays {
  const relaysEvent = getMostRecentReplacableEvent(
    events.filter((e) => e.kind === KIND_RELAY_METADATA_EVENT)
  );
  if (!relaysEvent) {
    return [];
  }
  return findAllRelays(relaysEvent);
}

export function mergeRelays<T extends Relays>(relays: T, relaysToMerge: T): T {
  const combinedRelays = [...relays, ...relaysToMerge];
  const uniqueRelays: T = combinedRelays.reduce(
    (rdx: T, current: Relay | SuggestedRelay) => {
      if (!rdx.some((relay) => relay.url === current.url)) {
        return [...rdx, current] as T;
      }
      return rdx;
    },
    [] as unknown as T
  );
  return uniqueRelays;
}

export function getSuggestedRelays(
  contactsRelays: Map<PublicKey, Relays>
): Array<SuggestedRelay> {
  const contactsWriteRelays = getWriteRelays(
    sanitizeRelays(Array.from(contactsRelays.values()).flat())
  );
  return contactsWriteRelays
    .reduce((rdx: Map<string, SuggestedRelay>, relay: Relay) => {
      const foundRelay = rdx.find((r) => r.url === relay.url);
      return rdx.set(relay.url, {
        ...relay,
        numberOfContacts: foundRelay ? foundRelay.numberOfContacts + 1 : 1,
      });
    }, Map<string, SuggestedRelay>())
    .valueSeq()
    .toArray();
}

export function getIsNecessaryReadRelays(
  contactsRelays: Map<PublicKey, Relays>
): (relayState: Relays) => Relays {
  return (relayState: Relays) => {
    return contactsRelays.reduce((rdx: Relays, cRelays: Relays): Relays => {
      const cWriteRelays = getWriteRelays(cRelays);
      const relayStateReadRelays = getReadRelays(relayState);
      const isOverlap = relayStateReadRelays.some((relay) =>
        cWriteRelays.some((cRelay) => relay.url === cRelay.url)
      );
      return isOverlap ? rdx : mergeRelays(rdx, cRelays);
    }, [] as Relays);
  };
}
