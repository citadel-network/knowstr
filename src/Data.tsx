import React from "react";
import "./App.css";
import { useEventQuery, useRelaysQuery } from "citadel-commons";
import { DataContextProvider } from "./DataContext";
import { KnowledgeDataProvider } from "./KnowledgeDataContext";
import { useContactsQuery, useContactsOfContactsQuery } from "./contacts";
import { useSettingsQuery } from "./settings";
import { DEFAULT_RELAYS } from "./nostr";
import { useApis } from "./Apis";

type DataProps = {
  blockstackUser: KeyPair;
  children: React.ReactNode;
};

function Data({ blockstackUser, children }: DataProps): JSX.Element {
  const myPublicKey = blockstackUser.publicKey;
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
    blockstackUser,
    relaysEose,
    readFromRelays
  );
  const [pec, contactsEose] = useContactsQuery(blockstackUser, readFromRelays);
  const contacts = pec.filter((_, k) => k !== myPublicKey);

  const [coc, contactsOfContactsEose] = useContactsOfContactsQuery(
    contacts,
    contactsEose,
    readFromRelays
  );
  const contactsOfContacts = coc.filter(
    (_, key) => key !== myPublicKey && !contacts.has(key)
  );

  if (!sentEventsEose || !contactsOfContactsEose || !settingsEose) {
    return <div className="loading" aria-label="loading" />;
  }

  const user = blockstackUser;

  return (
    <DataContextProvider
      contacts={contacts}
      contactsOfContacts={contactsOfContacts}
      user={user}
      sentEvents={sentEvents.toList()}
      settings={settings}
      relays={relays}
    >
      <KnowledgeDataProvider>{children}</KnowledgeDataProvider>
    </DataContextProvider>
  );
}
export default Data;
