import React from "react";
import "./App.css";
import {
  GroupedByAuthorFilter,
  sortEventsDescending,
  useEventQuery,
  useEventQueryByAuthor,
  useRelaysQuery,
} from "citadel-commons";
import { List, Map } from "immutable";
import { Event } from "nostr-tools";
import { DataContextProvider } from "./DataContext";
import { KnowledgeDataProvider } from "./KnowledgeDataContext";
import { findContacts } from "./contacts";
import { DEFAULT_RELAYS, KIND_KNOWLEDGE, KIND_REPUTATIONS } from "./nostr";
import { useApis } from "./Apis";
import { findKnowledgeDB } from "./knowledgeEvents";
import { DEFAULT_SETTINGS, findSettings } from "./settings";
import { newDB } from "./knowledge";

type DataProps = {
  user: KeyPair;
  children: React.ReactNode;
};

type ProcessedEvents = {
  settings: Settings;
  knowledgeDB: KnowledgeDataWithCommits;
  contacts: Contacts;
};

function createContactsEventsQueries(): GroupedByAuthorFilter {
  return {
    kinds: [KIND_REPUTATIONS, KIND_KNOWLEDGE],
  };
}

function processEventsByAuthor(
  authorEvents: List<Event>,
  author: PublicKey,
  user: KeyPair
): ProcessedEvents {
  const settings = findSettings(authorEvents);
  const contacts = findContacts(authorEvents);
  const knowledgeDB = findKnowledgeDB(authorEvents, user.publicKey);
  return {
    settings,
    contacts,
    knowledgeDB,
  };
}

function useEventProcessor(
  events: Map<string, Event>,
  user: KeyPair
): Map<PublicKey, ProcessedEvents> {
  const groupedByAuthor = events.groupBy((e) => e.pubkey as PublicKey);
  const sorted = groupedByAuthor.map((authorEvents) =>
    sortEventsDescending(List(authorEvents.valueSeq()))
  );
  return Map<PublicKey, ProcessedEvents>(
    sorted.toArray().map(([author, authorEvents]) => {
      return [author, processEventsByAuthor(authorEvents, author, user)];
    })
  );
}

function Data({ user, children }: DataProps): JSX.Element {
  const myPublicKey = user.publicKey;
  const { relayPool } = useApis();
  const { relays: myRelays } = useRelaysQuery(
    relayPool,
    [myPublicKey],
    true,
    DEFAULT_RELAYS
  );
  const relays = myRelays.length === 0 ? DEFAULT_RELAYS : myRelays;
  const readFromRelays = relays.filter((r) => r.read === true);
  const { events: sentEvents, eose: sentEventsEose } = useEventQuery(
    relayPool,
    [
      {
        authors: [myPublicKey],
      },
    ],
    { readFromRelays }
  );
  const processedEvents = useEventProcessor(sentEvents, user);
  const myProcessedEvents = processedEvents.get(myPublicKey, {
    contacts: Map<PublicKey, Contact>(),
    settings: DEFAULT_SETTINGS,
    knowledgeDB: newDB(),
  });
  const contacts = myProcessedEvents.contacts.filter(
    (_, k) => k !== myPublicKey
  );
  const contactsQueryResult = useEventQueryByAuthor(
    relayPool,
    [createContactsEventsQueries()],
    contacts.keySeq().toArray(),
    { readFromRelays }
  );
  const contactsEvents = contactsQueryResult.reduce(
    (rdx, result) => rdx.merge(result.events),
    Map<string, Event>()
  );
  const contactsData = useEventProcessor(contactsEvents, user);
  const contactsOfContacts = contactsData.reduce((coc, data, contact) => {
    return data.contacts.reduce(
      (rdx, contactOfContact, contactOfContactKey) => {
        if (
          contacts.has(contactOfContactKey) ||
          contactOfContactKey === myPublicKey
        ) {
          return rdx;
        }
        return rdx.set(contactOfContactKey, {
          ...contactOfContact,
          commonContact: contact,
        });
      },
      coc
    );
  }, Map<PublicKey, ContactOfContact>());

  const contactsOfContactsQueryResult = useEventQueryByAuthor(
    relayPool,
    [createContactsEventsQueries()],
    contactsOfContacts.keySeq().toArray(),
    { readFromRelays }
  );
  const contactsOfContactsEvents = contactsOfContactsQueryResult.reduce(
    (rdx, result) => rdx.merge(result.events),
    Map<string, Event>()
  );
  const contactsOfContactsData = useEventProcessor(
    contactsOfContactsEvents,
    user
  );

  const contactsKnowledgeDBs = contactsData.map((data) => data.knowledgeDB);
  const contactsOfContactsKnowledgeDBs = contactsOfContactsData.map(
    (data) => data.knowledgeDB
  );

  if (!sentEventsEose) {
    return <div className="loading" aria-label="loading" />;
  }

  const knowledgeDBs = Map<PublicKey, KnowledgeDataWithCommits>({
    [myPublicKey]: processedEvents.get(myPublicKey)?.knowledgeDB || newDB(),
  })
    .merge(contactsOfContactsKnowledgeDBs)
    .merge(contactsKnowledgeDBs);

  return (
    <DataContextProvider
      contacts={processedEvents.get(myPublicKey)?.contacts || Map()}
      contactsOfContacts={contactsOfContacts}
      user={user}
      sentEvents={sentEvents.toList()}
      settings={processedEvents.get(myPublicKey)?.settings || DEFAULT_SETTINGS}
      relays={relays}
      knowledgeDBs={knowledgeDBs}
    >
      <KnowledgeDataProvider>{children}</KnowledgeDataProvider>
    </DataContextProvider>
  );
}
export default Data;
