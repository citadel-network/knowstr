import React, { useEffect, useState } from "react";
import "./App.css";
import {
  GroupedByAuthorFilter,
  sortEventsDescending,
  useEventQuery,
  useEventQueryByAuthor,
  useRelaysQuery,
  getReadRelays,
} from "citadel-commons";
import { List, Map } from "immutable";
import { Event, UnsignedEvent } from "nostr-tools";
// eslint-disable-next-line import/no-unresolved
import { RelayInformation } from "nostr-tools/lib/types/nip11";
import { DataContextProvider } from "./DataContext";
import { findContacts } from "./contacts";
import {
  DEFAULT_RELAYS,
  KIND_KNOWLEDGE_LIST,
  KIND_KNOWLEDGE_NODE,
  KIND_CONTACTLIST,
  KIND_WORKSPACES,
  KIND_RELATION_TYPES,
  KIND_VIEWS,
  KIND_SETTINGS,
  KIND_DELETE,
  KIND_KNOWLEDGE_NODE_COLLECTION,
} from "./nostr";
import { useApis } from "./Apis";
import {
  findNodes,
  findRelationTypes,
  findRelations,
  findViews,
  findWorkspaces,
} from "./knowledgeEvents";
import { DEFAULT_SETTINGS, findSettings } from "./settings";
import { newDB } from "./knowledge";
import { PlanningContextProvider } from "./planner";
import { RootViewContextProvider } from "./ViewContext";
import { joinID } from "./connections";
import { mergeRelays, sanitizeRelays } from "./components/EditRelays";

type DataProps = {
  user: KeyPair;
  children: React.ReactNode;
};

type ProcessedEvents = {
  settings: Settings;
  knowledgeDB: KnowledgeData;
  contacts: Contacts;
};

const KINDS_CONTACTS = [
  KIND_SETTINGS,
  KIND_CONTACTLIST,
  KIND_WORKSPACES,
  KIND_RELATION_TYPES,
  KIND_KNOWLEDGE_LIST,
  KIND_KNOWLEDGE_NODE,
  KIND_KNOWLEDGE_NODE_COLLECTION,
  KIND_DELETE,
];

const KINDS_MYSELF = [...KINDS_CONTACTS, KIND_VIEWS];

export const KIND_SEARCH = [
  KIND_KNOWLEDGE_NODE_COLLECTION,
  KIND_KNOWLEDGE_NODE,
];

function createContactsEventsQueries(): GroupedByAuthorFilter {
  return {
    kinds: KINDS_CONTACTS,
  };
}

function processEventsByAuthor(
  authorEvents: List<UnsignedEvent | Event>
): ProcessedEvents {
  const settings = findSettings(authorEvents);
  const contacts = findContacts(authorEvents);
  const nodes = findNodes(authorEvents);
  const relations = findRelations(authorEvents);
  const workspaces = findWorkspaces(authorEvents);
  const views = findViews(authorEvents);
  const relationTypes = findRelationTypes(authorEvents);
  const knowledgeDB = {
    nodes,
    relations,
    workspaces: workspaces ? workspaces.workspaces : List<LongID>(),
    activeWorkspace: workspaces
      ? workspaces.activeWorkspace
      : ("my-first-workspace" as LongID),
    views,
    relationTypes,
  };
  return {
    settings,
    contacts,
    knowledgeDB,
  };
}

function useEventProcessor(
  events: List<UnsignedEvent>
): Map<PublicKey, ProcessedEvents> {
  const groupedByAuthor = events.groupBy((e) => e.pubkey as PublicKey);
  const sorted = groupedByAuthor.map((authorEvents) =>
    sortEventsDescending(List(authorEvents.valueSeq()))
  );
  return Map<PublicKey, ProcessedEvents>(
    sorted.toArray().map(([author, authorEvents]) => {
      return [author, processEventsByAuthor(authorEvents)];
    })
  );
}

function createDefaultEvents(user: KeyPair): List<UnsignedEvent> {
  const serialized = {
    w: [joinID(user.publicKey, "my-first-workspace")],
    a: joinID(user.publicKey, "my-first-workspace"),
  };
  const createWorkspaceNodeEvent = {
    kind: KIND_KNOWLEDGE_NODE,
    pubkey: user.publicKey,
    created_at: 0,
    tags: [["d", "my-first-workspace"]],
    content: "My first Workspace",
  };

  const writeWorkspacesEvent = {
    kind: KIND_WORKSPACES,
    pubkey: user.publicKey,
    created_at: 0,
    tags: [],
    content: JSON.stringify(serialized),
  };
  return List<UnsignedEvent>([createWorkspaceNodeEvent, writeWorkspacesEvent]);
}

export function useRelaysInfo(
  relays: Array<Relay>,
  eose: boolean
): Map<string, RelayInformation | undefined> {
  const { nip11 } = useApis();
  const [infos, setInfos] = useState<Map<string, RelayInformation | undefined>>(
    Map<string, RelayInformation | undefined>()
  );
  useEffect(() => {
    if (!eose) {
      return;
    }

    (async () => {
      const fetchedInfos = await Promise.all(
        relays.map(
          async (relay): Promise<[string, RelayInformation | undefined]> => {
            try {
              const info = await nip11.fetchRelayInformation(relay.url);
              return [relay.url, info];
            } catch {
              return [relay.url, undefined];
            }
          }
        )
      );
      setInfos(Map(fetchedInfos));
    })();
  }, [JSON.stringify(relays.map((r) => r.url)), eose]);
  return infos;
}

function Data({ user, children }: DataProps): JSX.Element {
  const myPublicKey = user.publicKey;
  const [newEvents, setNewEvents] = useState<List<UnsignedEvent>>(List());
  const { relayPool } = useApis();
  const { relays: myRelays, eose: relaysEose } = useRelaysQuery(
    relayPool,
    [myPublicKey],
    true,
    DEFAULT_RELAYS
  );
  const mergedRelays = mergeRelays(
    sanitizeRelays(DEFAULT_RELAYS),
    sanitizeRelays(myRelays)
  );
  const readFromRelays = getReadRelays(mergedRelays);
  const relaysInfo = useRelaysInfo(mergedRelays, relaysEose);
  const { events: sentEventsFromQuery, eose: sentEventsEose } = useEventQuery(
    relayPool,
    [
      {
        authors: [myPublicKey],
        kinds: KINDS_MYSELF,
      },
    ],
    { readFromRelays }
  );
  const sentEvents = createDefaultEvents(user).merge(
    sentEventsFromQuery.valueSeq().toList().merge(newEvents)
  );
  const processedEvents = useEventProcessor(sentEvents);
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
  const contactsData = useEventProcessor(contactsEvents.valueSeq().toList());

  const contactsKnowledgeDBs = contactsData.map((data) => data.knowledgeDB);

  if (!sentEventsEose) {
    return <div className="loading" aria-label="loading" />;
  }
  const myDB = processedEvents.get(myPublicKey)?.knowledgeDB || newDB();

  const knowledgeDBs = Map<PublicKey, KnowledgeData>({
    [myPublicKey]: myDB,
  }).merge(contactsKnowledgeDBs);

  const addNewEvents = (events: List<UnsignedEvent>): void => {
    setNewEvents((prev) => prev.merge(events));
  };

  return (
    <DataContextProvider
      contacts={processedEvents.get(myPublicKey)?.contacts || Map()}
      user={user}
      settings={processedEvents.get(myPublicKey)?.settings || DEFAULT_SETTINGS}
      relays={mergedRelays}
      knowledgeDBs={knowledgeDBs}
      relaysInfos={relaysInfo}
    >
      <PlanningContextProvider addNewEvents={addNewEvents}>
        <RootViewContextProvider root={myDB.activeWorkspace}>
          {children}
        </RootViewContextProvider>
      </PlanningContextProvider>
    </DataContextProvider>
  );
}
export default Data;
