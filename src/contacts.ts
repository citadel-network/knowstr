import { List, Map } from "immutable";
import { Event, Filter } from "nostr-tools";
import { useEventQuery } from "./useNostrQuery";
import { KIND_REPUTATIONS, getMostRecentReplacableEvent } from "./nostr";
import { useApis } from "./Apis";
import { symmetricDecryptPayload } from "./encryption";

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

export function parseContactEvent(
  event: Event,
  broadcastKey: Buffer,
  decryptSymmetric: DecryptSymmetric
): Contacts {
  const rawContacts = symmetricDecryptPayload<{
    [publicKey: PublicKey]: RawContact;
  }>({
    payload: event.content,
    encryptionKey: broadcastKey,
    decryptSymmetric,
  });
  if (!rawContacts) {
    return Map<PublicKey, Contact>();
  }
  return Map<PublicKey, RawContact>(rawContacts).mapEntries(([, contact]) => {
    return [
      contact.publicKey,
      {
        ...contact,
        createdAt: contact.createdAt ? new Date(contact.createdAt) : undefined,
      },
    ];
  });
}

export function useContactsQuery(
  user: KeyPair,
  myBroadcastKey: Buffer | undefined,
  enabled: boolean,
  readFromRelays: Relays
): [Contacts, boolean] {
  const { encryption } = useApis();
  const { events, eose } = useEventQuery(
    [createContactsQuery([user.publicKey])],
    {
      enabled,
      readFromRelays,
    }
  );
  if (!eose || !myBroadcastKey) {
    return [Map<PublicKey, Contact>(), eose];
  }
  const encryptedContactsEvent = getMostRecentReplacableEvent(events);
  if (!encryptedContactsEvent) {
    return [Map<PublicKey, Contact>(), eose];
  }
  return [
    parseContactEvent(
      encryptedContactsEvent,
      myBroadcastKey,
      encryption.decryptSymmetric
    ),
    eose,
  ];
}

export function createContactsOfContactsQuery(
  contacts: Contacts,
  broadcastKeys: BroadcastKeys
): Filter<number> {
  const contactsWithBroadcastKeys = contacts
    .filter((contact) => broadcastKeys.has(contact.publicKey))
    .keySeq()
    .sortBy((k) => k)
    .toArray();
  return createContactsQuery(contactsWithBroadcastKeys);
}

export function decryptContactOfContactsEvents(
  events: List<Event<number>>,
  contacts: Contacts,
  broadcastKeys: BroadcastKeys,
  decryptSymmetric: DecryptSymmetric
): ContactsOfContacts {
  return events.reduce((rdx, event) => {
    const broadcastKey = broadcastKeys.get(event.pubkey as PublicKey);
    const commonContact = contacts.get(event.pubkey as PublicKey);
    if (!broadcastKey || !commonContact) {
      return rdx;
    }
    return rdx.merge(
      parseContactEvent(event, broadcastKey, decryptSymmetric).map(
        (contact) => ({
          ...contact,
          commonContact: commonContact.publicKey,
        })
      )
    );
  }, Map<PublicKey, ContactOfContact>());
}

export function useContactsOfContactsQuery(
  contacts: Contacts,
  broadcastKeys: BroadcastKeys,
  dependenciesEose: boolean,
  readFromRelays: Relays
): [ContactsOfContacts, boolean] {
  const { encryption } = useApis();
  const query = createContactsOfContactsQuery(contacts, broadcastKeys);

  const { events, eose } = useEventQuery([query], {
    enabled: dependenciesEose,
    readFromRelays,
  });
  if (!eose) {
    return [Map<PublicKey, ContactOfContact>(), eose];
  }

  return [
    decryptContactOfContactsEvents(
      events.valueSeq().toList(),
      contacts,
      broadcastKeys,
      encryption.decryptSymmetric
    ),
    eose,
  ];
}
