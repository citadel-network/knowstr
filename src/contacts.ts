import { List, Map } from "immutable";
import { Event, Filter } from "nostr-tools";
import { useEventQuery, getMostRecentReplacableEvent } from "citadel-commons";
import { KIND_REPUTATIONS } from "./nostr";
import { useApis } from "./Apis";

type RawContact = {
  publicKey: PublicKey;
  createdAt: string | undefined;
};

export function createContactsQuery(authors: PublicKey[]): Filter<number> {
  return {
    kinds: [KIND_REPUTATIONS],
    authors,
  };
}

export function parseContactEvent(event: Event): Contacts {
  const rawContacts = JSON.parse(event.content) as {
    [publicKey: PublicKey]: RawContact;
  };
  if (!rawContacts) {
    return Map<PublicKey, Contact>();
  }
  return Map<PublicKey, RawContact>(rawContacts)
    .mapEntries(([, contact]) => {
      return [
        contact.publicKey,
        {
          ...contact,
          createdAt: contact.createdAt
            ? new Date(contact.createdAt)
            : undefined,
        },
      ];
    })
    .filter((pubKey, contact) => pubKey !== undefined && contact !== undefined);
}

export function useContactsQuery(
  user: KeyPair,
  readFromRelays: Relays
): [Contacts, boolean] {
  const { relayPool } = useApis();
  const { events, eose } = useEventQuery(
    relayPool,
    [createContactsQuery([user.publicKey])],
    {
      readFromRelays,
    }
  );
  if (!eose) {
    return [Map<PublicKey, Contact>(), eose];
  }
  const encryptedContactsEvent = getMostRecentReplacableEvent(events);
  if (!encryptedContactsEvent) {
    return [Map<PublicKey, Contact>(), eose];
  }
  return [parseContactEvent(encryptedContactsEvent), eose];
}

export function createContactsOfContactsQuery(
  contacts: Contacts
): Filter<number> {
  const contactsPublicKeys = contacts
    .keySeq()
    .sortBy((k) => k)
    .toArray();
  return createContactsQuery(contactsPublicKeys);
}

export function parseContactOfContactsEvents(
  events: List<Event<number>>
): ContactsOfContacts {
  return events.reduce((rdx, event) => {
    return rdx.merge(
      parseContactEvent(event).map((contact) => ({
        ...contact,
        commonContact: event.pubkey as PublicKey,
      }))
    );
  }, Map<PublicKey, ContactOfContact>());
}

export function useContactsOfContactsQuery(
  contacts: Contacts,
  dependenciesEose: boolean,
  readFromRelays: Relays
): [ContactsOfContacts, boolean] {
  const { relayPool } = useApis();
  const query = createContactsOfContactsQuery(contacts);

  const { events, eose } = useEventQuery(relayPool, [query], {
    enabled: dependenciesEose,
    readFromRelays,
  });
  if (!eose) {
    return [Map<PublicKey, ContactOfContact>(), eose];
  }

  return [parseContactOfContactsEvents(events.valueSeq().toList()), eose];
}
