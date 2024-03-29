import React, { useEffect, useState } from "react";
import "./App.css";
import {
  sortEventsDescending,
  useEventQuery,
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
  KIND_KNOWLEDGE_NODE,
  KIND_CONTACTLIST,
  KIND_WORKSPACES,
  KIND_RELATION_TYPES,
  KIND_VIEWS,
  KIND_SETTINGS,
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
import {
  addNodeToFilters,
  adddWorkspacesToFilter,
  buildPrimaryDataQueryFromViews,
  buildReferencedByListsQuery,
  buildSecondaryDataQuery,
  filtersToFilterArray,
  merge,
  sanitizeFilter,
} from "./dataQuery";
import { useWorkspaceFromURL } from "./KnowledgeDataContext";
import { useNodeIDFromURL } from "./components/FullScreenViewWrapper";
import { useDefaultRelays } from "./NostrAuthContext";

type DataProps = {
  user: KeyPair;
  children: React.ReactNode;
};

type ProcessedEvents = {
  settings: Settings;
  knowledgeDB: KnowledgeData;
  contacts: Contacts;
};

export const KIND_SEARCH = [
  KIND_KNOWLEDGE_NODE_COLLECTION,
  KIND_KNOWLEDGE_NODE,
];

const KINDS_CONTACTS_META = [KIND_WORKSPACES, KIND_RELATION_TYPES];

const KINDS_META = [
  KIND_SETTINGS,
  KIND_CONTACTLIST,
  KIND_WORKSPACES,
  KIND_RELATION_TYPES,
  KIND_VIEWS,
];

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

function mergePublishResults(
  existing: PublishResults,
  newResult: PublishResultsOfEvent
): PublishResults {
  const updatedResults = newResult.map((value, key) => {
    const existingValue = existing.get(key);
    if (!existingValue) {
      return [value];
    }
    return [...existingValue, value];
  });
  return existing.merge(updatedResults);
}

function Data({ user, children }: DataProps): JSX.Element {
  const defaultRelays = useDefaultRelays();
  const myPublicKey = user.publicKey;
  const [newEventsAndPublishResults, setNewEventsAndPublishResults] = useState<{
    events: List<UnsignedEvent>;
    results: PublishResults;
  }>({ events: List(), results: Map() });
  const [loadingResults, setLoadingResults] = useState<boolean>(false);
  const { relayPool } = useApis();
  const { relays: myRelays, eose: relaysEose } = useRelaysQuery(
    relayPool,
    [myPublicKey],
    true,
    defaultRelays
  );

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
  const metaEvents = createDefaultEvents(user).merge(
    mE.valueSeq().toList().merge(newEventsAndPublishResults.events)
  );

  const processedMetaEvents = useEventProcessor(metaEvents).get(myPublicKey, {
    contacts: Map<PublicKey, Contact>(),
    settings: DEFAULT_SETTINGS,
    knowledgeDB: newDB(),
  });
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

  const myViews = processedMetaEvents.knowledgeDB.views;

  const activeWorkspace =
    useWorkspaceFromURL() || processedMetaEvents.knowledgeDB.activeWorkspace;

  // Workspaces, relations of activeWorkspace and nodes and relations marked as expanded in views
  const initialFilters = buildPrimaryDataQueryFromViews(
    myViews,
    myPublicKey,
    contacts,
    activeWorkspace
  );

  // Might be a duplicate, but duplicates will get removed anyway
  const nodeFromURL = useNodeIDFromURL();
  const filterWithRoot = nodeFromURL
    ? addNodeToFilters(initialFilters, nodeFromURL)
    : initialFilters;

  const initialFiltersWithMyWorkspaces = adddWorkspacesToFilter(
    filterWithRoot,
    processedMetaEvents.knowledgeDB.workspaces as List<LongID>
  );

  const initialFiltersWithWorkspaces = processedContactMetaEvents.reduce(
    (rdx, p) =>
      adddWorkspacesToFilter(rdx, p.knowledgeDB.workspaces as List<LongID>),
    initialFiltersWithMyWorkspaces
  );

  const { events: initialDataEvents, eose: dataEventsEose } = useEventQuery(
    relayPool,
    filtersToFilterArray(initialFiltersWithWorkspaces),
    {
      readFromRelays,
      enabled: metaEventsEose && contactsMetaEventsEose,
    }
  );

  // process events
  const initialDataEventsProcessed = useEventProcessor(
    initialDataEvents
      .valueSeq()
      .toList()
      .merge(newEventsAndPublishResults.events)
  );
  const primaryKnowledgeDBs = initialDataEventsProcessed.map(
    (data) => data.knowledgeDB
  );

  // Nodes, and lists attached in Relations fetched in primary query
  const secondaryDataQuery = buildSecondaryDataQuery(
    primaryKnowledgeDBs,
    contacts,
    myPublicKey,
    initialFiltersWithWorkspaces
  );

  const { events: secondaryDataEvents, eose: secondaryDataEventsEose } =
    useEventQuery(relayPool, filtersToFilterArray(secondaryDataQuery), {
      readFromRelays,
      enabled: dataEventsEose,
    });

  const dataEventsProcessed = useEventProcessor(
    metaEvents
      .merge(contactMetaEvents.valueSeq().toList())
      .merge(initialDataEvents.valueSeq().toList())
      .merge(secondaryDataEvents.valueSeq().toList())
      .merge(newEventsAndPublishResults.events)
  );
  const knowledgeDBsSeondLevel = dataEventsProcessed.map(
    (data) => data.knowledgeDB
  );

  const tertiaryDataQuery = buildSecondaryDataQuery(
    knowledgeDBsSeondLevel,
    contacts,
    myPublicKey,
    merge(initialFiltersWithWorkspaces, secondaryDataQuery)
  );

  const enableTertiary =
    sanitizeFilter(tertiaryDataQuery.knowledgeListbyID, "#d") !== undefined ||
    sanitizeFilter(tertiaryDataQuery.knowledgeListByHead, "#k") !== undefined ||
    sanitizeFilter(tertiaryDataQuery.knowledgeNodesByID, "#d") !== undefined;

  const { events: tertiaryDataEvents, eose: tertiaryEventsEose } =
    useEventQuery(relayPool, filtersToFilterArray(tertiaryDataQuery), {
      readFromRelays,
      enabled: secondaryDataEventsEose && enableTertiary,
    });

  const tDataEventsProcessed = useEventProcessor(
    metaEvents
      .merge(contactMetaEvents.valueSeq().toList())
      .merge(initialDataEvents.valueSeq().toList())
      .merge(secondaryDataEvents.valueSeq().toList())
      .merge(tertiaryDataEvents.valueSeq().toList())
      .merge(newEventsAndPublishResults.events)
  );
  const tknowledgeDBs = tDataEventsProcessed.map((data) => data.knowledgeDB);

  const referencedByListsQuery = buildReferencedByListsQuery(
    tknowledgeDBs,
    contacts,
    myPublicKey
  );
  const { events: referencedByListsEvents, eose: referencedByListsEose } =
    useEventQuery(relayPool, [referencedByListsQuery], {
      readFromRelays,
      enabled:
        tertiaryEventsEose || (!enableTertiary && secondaryDataEventsEose),
    });
  const referencedListsQueryResult = useEventProcessor(
    referencedByListsEvents.valueSeq().toList()
  );
  const referencedNodesQuery = buildSecondaryDataQuery(
    referencedListsQueryResult.map((data) => data.knowledgeDB),
    contacts,
    myPublicKey,
    merge(initialFiltersWithWorkspaces, secondaryDataQuery)
  );

  const { events: referencedNodes } = useEventQuery(
    relayPool,
    [referencedNodesQuery],
    {
      readFromRelays,
      enabled: referencedByListsEose,
    }
  );
  const rDataEventsProcessed = useEventProcessor(
    metaEvents
      .merge(contactMetaEvents.valueSeq().toList())
      .merge(initialDataEvents.valueSeq().toList())
      .merge(secondaryDataEvents.valueSeq().toList())
      .merge(tertiaryDataEvents.valueSeq().toList())
      .merge(referencedByListsEvents.valueSeq().toList())
      .merge(referencedNodes.valueSeq().toList())
      .merge(newEventsAndPublishResults.events)
  );
  const knowledgeDBs = rDataEventsProcessed.map((data) => data.knowledgeDB);

  if (!secondaryDataEventsEose) {
    return <div className="loading" aria-label="loading" />;
  }

  const addNewEvents = (events: List<UnsignedEvent>): void => {
    setLoadingResults(true);
    setNewEventsAndPublishResults((prev) => {
      return {
        events: prev.events.merge(events),
        results: prev.results,
      };
    });
  };

  const updatePublishResults = (
    results: Array<PublishResultsOfEvent>
  ): void => {
    setNewEventsAndPublishResults((prev) => {
      return {
        events: prev.events,
        results: results.reduce(
          (rdx, res) => mergePublishResults(rdx, res),
          prev.results
        ),
      };
    });
    setLoadingResults(false);
  };

  return (
    <DataContextProvider
      contacts={contacts}
      user={user}
      settings={processedMetaEvents.settings}
      relays={sanitizeRelays(myRelays)}
      knowledgeDBs={knowledgeDBs}
      relaysInfos={relaysInfo}
      publishResults={newEventsAndPublishResults.results}
      loadingResults={loadingResults}
    >
      <PlanningContextProvider
        addNewEvents={addNewEvents}
        updatePublishResults={updatePublishResults}
      >
        <RootViewContextProvider root={activeWorkspace}>
          {children}
        </RootViewContextProvider>
      </PlanningContextProvider>
    </DataContextProvider>
  );
}
export default Data;
