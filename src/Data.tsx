import React from "react";
import "./App.css";
import { useEventQuery, useRelaysQuery } from "citadel-commons";
import { DataContextProvider } from "./DataContext";
import { KnowledgeDataProvider } from "./KnowledgeDataContext";
import { useContactsQuery, useContactsOfContactsQuery } from "./contacts";
import { useSettingsQuery } from "./settings";
import { DEFAULT_RELAYS } from "./nostr";
import { useApis } from "./Apis";
import { useKnowledgeQuery } from "./knowledgeEvents";

type DataProps = {
  user: KeyPair;
  children: React.ReactNode;
};

function Data({ user, children }: DataProps): JSX.Element {
  const myPublicKey = user.publicKey;
  const { relayPool } = useApis();
  const { relays: myRelays, eose: relaysEose } = useRelaysQuery(
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
    { enabled: relaysEose, readFromRelays }
  );

  const [settings, settingsEose] = useSettingsQuery(
    user,
    relaysEose,
    readFromRelays
  );
  const [pec, contactsEose] = useContactsQuery(user, readFromRelays);
  const contacts = pec.filter((_, k) => k !== myPublicKey);

  const [coc, contactsOfContactsEose] = useContactsOfContactsQuery(
    contacts,
    contactsEose,
    readFromRelays
  );
  const contactsOfContacts = coc.filter(
    (_, key) => key !== myPublicKey && !contacts.has(key)
  );

  const [knowledgeDBs, knowledgeDBsEose] = useKnowledgeQuery(
    contacts
      .merge(contactsOfContacts)
      .set(user.publicKey, user)
      .keySeq()
      .toArray(),
    user.publicKey,
    sentEventsEose && contactsEose && contactsOfContactsEose,
    readFromRelays
  );

  if (
    !sentEventsEose ||
    !contactsOfContactsEose ||
    !settingsEose ||
    !knowledgeDBsEose
  ) {
    return <div className="loading" aria-label="loading" />;
  }

  return (
    <DataContextProvider
      contacts={contacts}
      contactsOfContacts={contactsOfContacts}
      user={user}
      sentEvents={sentEvents.toList()}
      settings={settings}
      relays={relays}
      knowledgeDBs={knowledgeDBs}
    >
      <KnowledgeDataProvider>{children}</KnowledgeDataProvider>
    </DataContextProvider>
  );
}
export default Data;
