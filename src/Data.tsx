import React from "react";
import "./App.css";
import { Map } from "immutable";
import { DataContextProvider } from "./DataContext";
import { KnowledgeDataProvider } from "./KnowledgeDataContext";
import { useBroadcastKeysQuery } from "./broadcastKeys";
import { useEventQuery, useRelaysQuery } from "./useNostrQuery";
import { useContactsQuery, useContactsOfContactsQuery } from "./contacts";
import { useSettingsQuery } from "./settings";
import { DEFAULT_RELAYS } from "./nostr";

type DataProps = {
  blockstackUser: KeyPair;
  children: React.ReactNode;
};

function Data({ blockstackUser, children }: DataProps): JSX.Element {
  const myPublicKey = blockstackUser.publicKey;
  const { relays: myRelays, eose: relaysEose } = useRelaysQuery(
    [myPublicKey],
    true,
    DEFAULT_RELAYS
  );
  const relays = myRelays.length === 0 ? DEFAULT_RELAYS : myRelays;
  const readFromRelays = relays.filter((r) => r.read === true);
  const { events: sentEvents, eose: sentEventsEose } = useEventQuery(
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
  const [myBroadcastKeyQueryResult, myBroadcastKeyEose] = useBroadcastKeysQuery(
    blockstackUser,
    [myPublicKey],
    relaysEose,
    readFromRelays
  );
  const myBroadcastKey =
    myBroadcastKeyQueryResult && myBroadcastKeyQueryResult.get(myPublicKey);

  const [pec, contactsEose] = useContactsQuery(
    blockstackUser,
    myBroadcastKey,
    myBroadcastKeyEose,
    readFromRelays
  );
  const contacts = pec.filter((_, k) => k !== myPublicKey);

  const [bks, eoseBroadcastKeys] = useBroadcastKeysQuery(
    blockstackUser,
    contacts
      .toList()
      .map((c) => c.publicKey)
      .toArray(),
    contactsEose,
    readFromRelays
  );

  const [coc, contactsOfContactsEose] = useContactsOfContactsQuery(
    contacts,
    bks || Map<PublicKey, Buffer>(),
    eoseBroadcastKeys,
    readFromRelays
  );
  const contactsOfContacts = coc.filter(
    (_, key) => key !== myPublicKey && !contacts.has(key)
  );

  const [contactsOfContactsBks, contactsOfContactsBksEose] =
    useBroadcastKeysQuery(
      blockstackUser,
      contactsOfContacts
        .toList()
        .map((c) => c.publicKey)
        .toArray(),
      contactsOfContactsEose,
      readFromRelays
    );

  const otherUsersBroadcastKeys = (bks || Map<PublicKey, Buffer>()).merge(
    contactsOfContactsBks || Map<PublicKey, Buffer>()
  );

  const broadcastKeys = myBroadcastKey
    ? otherUsersBroadcastKeys.set(myPublicKey, myBroadcastKey)
    : otherUsersBroadcastKeys;

  if (
    !sentEventsEose ||
    !myBroadcastKeyEose ||
    !bks ||
    !contactsOfContactsBks ||
    !contactsOfContactsEose ||
    !contactsOfContactsBksEose ||
    !settingsEose
  ) {
    return <div className="loading" aria-label="loading" />;
  }

  const user = blockstackUser;

  return (
    <DataContextProvider
      contacts={contacts}
      contactsOfContacts={contactsOfContacts}
      broadcastKeys={broadcastKeys}
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
