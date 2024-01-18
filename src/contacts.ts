import { List, Map } from "immutable";
import { Event, Filter } from "nostr-tools";
import { getMostRecentReplacableEvent } from "citadel-commons";
import { KIND_REPUTATIONS } from "./nostr";

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

export function findContacts(events: List<Event>): Contacts {
  const contactEvent = getMostRecentReplacableEvent(
    events.filter((event) => event.kind === KIND_REPUTATIONS)
  );
  if (!contactEvent) {
    return Map<PublicKey, Contact>();
  }
  return parseContactEvent(contactEvent);
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
