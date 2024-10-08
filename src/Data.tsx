import React, { useEffect, useState } from "react";
import "./App.css";
import {
  sortEventsDescending,
  useEventQuery,
  createRelaysQuery,
  findRelays,
  mergeRelays,
  sanitizeRelays,
  getReadRelays,
  getMostRecentReplacableEvent,
  findAllRelays,
  KIND_RELAY_METADATA_EVENT,
} from "citadel-commons";
import { List, Map } from "immutable";
import { Event, UnsignedEvent } from "nostr-tools";
// eslint-disable-next-line import/no-unresolved
import { RelayInformation } from "nostr-tools/lib/types/nip11";
import {
  KIND_KNOWLEDGE_NODE,
  KIND_CONTACTLIST,
  KIND_WORKSPACES,
  KIND_VIEWS,
  KIND_SETTINGS,
  KIND_DELETE,
  KIND_PROJECT,
} from "./nostr";
import { DataContextProvider } from "./DataContext";
import { findContacts } from "./contacts";
import { useApis } from "./Apis";
import {
  findNodes,
  findRelations,
  findViews,
  findWorkspaces,
} from "./knowledgeEvents";
import { DEFAULT_SETTINGS, findSettings } from "./settings";
import { newDB } from "./knowledge";
import {
  PlanningContextProvider,
  fallbackWorkspace,
  replaceUnauthenticatedUser,
} from "./planner";
import { RootViewContextProvider } from "./ViewContext";
import {
  addWorkspacesToFilter,
  createBaseFilter,
  filtersToFilterArray,
} from "./dataQuery";
import { useWorkspaceFromURL } from "./KnowledgeDataContext";
import { useDefaultRelays, useDefaultWorkspace } from "./NostrAuthContext";

type DataProps = {
  user: User;
  children: React.ReactNode;
};

type ProcessedEvents = {
  settings: Settings;
  knowledgeDB: KnowledgeData;
  contacts: Contacts;
  relays: Relays;

  views: Views;
  workspaces: List<ID>;
  activeWorkspace: LongID | undefined;
};

function newProcessedEvents(): ProcessedEvents {
  return {
    settings: DEFAULT_SETTINGS,
    knowledgeDB: newDB(),
    contacts: Map<PublicKey, Contact>(),
    relays: [],
    views: Map<string, View>(),
    activeWorkspace: undefined,
    workspaces: List<ID>(),
  };
}

export const KIND_SEARCH = [KIND_KNOWLEDGE_NODE, KIND_DELETE, KIND_PROJECT];

const KINDS_CONTACTS_META = [KIND_WORKSPACES, KIND_RELAY_METADATA_EVENT];

export const KINDS_META = [
  KIND_SETTINGS,
  KIND_CONTACTLIST,
  KIND_WORKSPACES,
  KIND_VIEWS,
];

function mergeEvents(
  processed: ProcessedEvents,
  events: List<UnsignedEvent | Event>
): ProcessedEvents {
  const workspaces = findWorkspaces(events) || {
    workspaces: List<ID>(),
    activeWorkspace: undefined,
  };

  const newWorkspaces = processed.workspaces
    .merge(workspaces.workspaces)
    .toSet()
    .toList();

  return {
    ...processed,
    contacts: processed.contacts.merge(findContacts(events)),
    workspaces: newWorkspaces,
    activeWorkspace: processed.activeWorkspace || workspaces.activeWorkspace,
    views: findViews(events).merge(processed.views),
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
  const knowledgeDB = {
    nodes,
    relations,
  };
  const relays = findRelays(authorEvents);
  return {
    settings,
    contacts,
    knowledgeDB,
    relays,
    views,
    workspaces: workspaces ? workspaces.workspaces : List<ID>(),
    activeWorkspace: workspaces ? workspaces.activeWorkspace : undefined,
  };
}

export function useEventProcessor(
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
  const defaultRelays = useDefaultRelays();
  const defaultWorkspace = useDefaultWorkspace();
  const myPublicKey = user.publicKey;
  const [newEventsAndPublishResults, setNewEventsAndPublishResults] =
    useState<EventState>({
      unsignedEvents: List(),
      results: Map(),
      isLoading: false,
      preLoginEvents: List(),
    });
  const [fallbackWSID] = useState(fallbackWorkspace(myPublicKey));
  const { relayPool } = useApis();
  const { events: relaysEvents, eose: relaysEose } = useEventQuery(
    relayPool,
    [createRelaysQuery([myPublicKey])],
    { enabled: true, readFromRelays: defaultRelays }
  );

  const newestEvent = getMostRecentReplacableEvent(relaysEvents);
  const myRelays = newestEvent ? findAllRelays(newestEvent) : defaultRelays;

  const mergedRelays = mergeRelays(
    sanitizeRelays(defaultRelays),
    sanitizeRelays(myRelays)
  );
  const readFromRelays = getReadRelays(mergedRelays);
  const relaysInfo = useRelaysInfo(mergedRelays, relaysEose);
  const { events: mE, eose: metaEventsEose } = useEventQuery(
    relayPool,
    [
      {
        authors: [myPublicKey],
        kinds: KINDS_META,
      },
    ],
    { readFromRelays }
  );
  const metaEvents = mE
    .valueSeq()
    .toList()
    .merge(newEventsAndPublishResults.unsignedEvents);

  const processedMetaEvents = mergeEvents(
    useEventProcessor(metaEvents).get(myPublicKey, newProcessedEvents()),
    newEventsAndPublishResults.preLoginEvents
  );
  const contacts = processedMetaEvents.contacts.filter(
    (_, k) => k !== myPublicKey
  );

  const { events: contactMetaEvents, eose: contactsMetaEventsEose } =
    useEventQuery(
      relayPool,
      [{ authors: contacts.keySeq().toArray(), kinds: KINDS_CONTACTS_META }],
      { readFromRelays, enabled: metaEventsEose }
    );

  const processedContactMetaEvents = useEventProcessor(
    contactMetaEvents.valueSeq().toList()
  );

  const contactsRelays = processedContactMetaEvents.reduce((rdx, p, key) => {
    return rdx.set(key, p.relays);
  }, Map<PublicKey, Relays>());

  const wsFromURL = useWorkspaceFromURL();
  const activeWorkspace =
    wsFromURL !== undefined
      ? replaceUnauthenticatedUser(wsFromURL, user.publicKey)
      : processedMetaEvents.activeWorkspace || defaultWorkspace || fallbackWSID;

  const workspaceFilters = processedContactMetaEvents.reduce((rdx, p) => {
    return addWorkspacesToFilter(rdx, p.workspaces as List<LongID>);
  }, addWorkspacesToFilter(createBaseFilter(contacts, myPublicKey), processedMetaEvents.workspaces as List<LongID>));

  const { events: workspaceEvents } = useEventQuery(
    relayPool,
    filtersToFilterArray(workspaceFilters),
    {
      readFromRelays,
      enabled: metaEventsEose && contactsMetaEventsEose,
    }
  );

  const rDataEventsProcessed = useEventProcessor(
    metaEvents
      .merge(contactMetaEvents.valueSeq().toList())
      .merge(workspaceEvents.valueSeq().toList())
  );
  const knowledgeDBs = rDataEventsProcessed.map((data) => data.knowledgeDB);

  const contactsWorkspaces = rDataEventsProcessed
    .map((data) => data.workspaces)
    .filter((_, k) => k !== myPublicKey);

  return (
    <DataContextProvider
      contacts={contacts}
      user={user}
      settings={processedMetaEvents.settings}
      relays={sanitizeRelays(myRelays)}
      contactsRelays={contactsRelays}
      knowledgeDBs={knowledgeDBs}
      relaysInfos={relaysInfo}
      publishEventsStatus={newEventsAndPublishResults}
      views={processedMetaEvents.views}
      workspaces={processedMetaEvents.workspaces}
      activeWorkspace={activeWorkspace}
      contactsWorkspaces={contactsWorkspaces}
    >
      <PlanningContextProvider setPublishEvents={setNewEventsAndPublishResults}>
        <RootViewContextProvider root={activeWorkspace}>
          {children}
        </RootViewContextProvider>
      </PlanningContextProvider>
    </DataContextProvider>
  );
}
export default Data;
