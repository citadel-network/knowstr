import { List, Map } from "immutable";
import { Event } from "nostr-tools";
import { getMostRecentReplacableEvent } from "citadel-commons";
import { KIND_CONTACTLIST } from "./nostr";

type RawContact = {
  publicKey: PublicKey;
  createdAt: string | undefined;
};

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
    events.filter((event) => event.kind === KIND_CONTACTLIST)
  );
  if (!contactEvent) {
    return Map<PublicKey, Contact>();
  }
  return parseContactEvent(contactEvent);
}
