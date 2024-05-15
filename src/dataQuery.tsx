import React, { useEffect, useRef, useState } from "react";
import { Filter } from "nostr-tools";
import { List, Set } from "immutable";
import {
  useEventQuery,
  KIND_DELETE,
  KIND_KNOWLEDGE_LIST,
  KIND_KNOWLEDGE_NODE,
  KIND_KNOWLEDGE_NODE_COLLECTION,
} from "citadel-commons";
import { splitID, stripIndex } from "./connections";
import { useNodeID } from "./ViewContext";
import { MergeKnowledgeDB, useData } from "./DataContext";
import { useApis } from "./Apis";
import { useEventProcessor } from "./Data";
import { RegisterQuery, extractNodesFromQueries } from "./LoadingStatus";

function addIDToFilter(filter: Filter, id: LongID, tag: `#${string}`): Filter {
  const d = filter[tag] || [];
  const local = splitID(id)[1];
  // TODO: Add unknown remotes? Or even better create a filter for each unknown remote to query specific ids
  // strip index from ID when we look for a node belonging to a collection

  // If we look for a collection add node with collection stripped
  const ids = filter.kinds?.includes(KIND_KNOWLEDGE_NODE_COLLECTION)
    ? [local, stripIndex(local)]
    : [local];
  const filteredIDs = ids.filter((i) => !d.includes(i));
  if (filteredIDs.length === 0) {
    return filter;
  }
  return {
    ...filter,
    [tag]: [...d, ...filteredIDs],
  };
}

// {
//    KIND: [KIND_KNOWLEDGE_LIST],
//    #d: [relationID]
// }
// {
//    KIND: [KIND_KNOWLEDGE_NODE, KIND_KNOWLEDGE_NODE_COLLECTION],
//    #d: [nodeID]
// }
// {
//    KIND: [KIND_KNOWLEDGE_LIST],
//    #k: [nodeID]
// }
//
type Filters = {
  knowledgeListbyID: Filter;
  knowledgeNodesByID: Filter;
  knowledgeListByHead: Filter;
  referencedBy: Filter;
  deleteFilter: Filter;
};

export function sanitizeFilter(
  filter: Filter,
  tag: `#${string}`
): Filter | undefined {
  const values = Set(filter[tag] || []).toArray();
  if (values.length === 0) {
    return undefined;
  }
  return {
    ...filter,
    [tag]: values,
  };
}

export function filtersToFilterArray(filters: Filters): Filter[] {
  return [
    sanitizeFilter(filters.knowledgeListbyID, "#d"),
    sanitizeFilter(filters.knowledgeNodesByID, "#d"),
    sanitizeFilter(filters.knowledgeListByHead, "#k"),
    sanitizeFilter(filters.referencedBy, "#i"),
    filters.deleteFilter,
  ].filter((f) => f !== undefined) as Filter[];
}

export function addNodeToFilters(filters: Filters, id: LongID): Filters {
  return {
    ...filters,
    knowledgeNodesByID: addIDToFilter(filters.knowledgeNodesByID, id, "#d"),
    knowledgeListByHead: addIDToFilter(filters.knowledgeListByHead, id, "#k"),
  };
}

export function addReferencedByToFilters(
  filters: Filters,
  id: LongID
): Filters {
  const filter = filters.referencedBy;
  const d = filter["#i"] || [];
  const updatedFilter = {
    ...filter,
    "#i": [...d, id],
  };
  return {
    ...filters,
    referencedBy: updatedFilter,
  };
}

export function addListToFilters(filters: Filters, listID: LongID): Filters {
  return {
    ...filters,
    knowledgeListbyID: addIDToFilter(filters.knowledgeListbyID, listID, "#d"),
  };
}

export function addWorkspaceToFilter(filters: Filters, id: LongID): Filters {
  return addNodeToFilters(filters, id);
}

export function addWorkspacesToFilter(
  filters: Filters,
  workspaces: List<LongID>
): Filters {
  return workspaces.reduce((rdx, id) => addWorkspaceToFilter(rdx, id), filters);
}

export function createBaseFilter(
  contacts: Contacts,
  myself: PublicKey
): Filters {
  const authors = [...contacts.keySeq().toArray(), myself] as string[];
  return {
    knowledgeListbyID: {
      kinds: [KIND_KNOWLEDGE_LIST],
      authors,
    },
    knowledgeNodesByID: {
      kinds: [KIND_KNOWLEDGE_NODE, KIND_KNOWLEDGE_NODE_COLLECTION],
      authors,
    },
    knowledgeListByHead: {
      kinds: [KIND_KNOWLEDGE_LIST],
      authors,
    },
    referencedBy: {
      kinds: [KIND_KNOWLEDGE_LIST],
      authors,
    },
    deleteFilter: {
      kinds: [KIND_DELETE],
      authors,
    },
  } as Filters;
}

function isOnlyDelete(filters: Filter[]): boolean {
  return !!(
    filters.length === 1 &&
    filters[0].kinds?.includes(KIND_DELETE) &&
    filters[0].kinds.length === 1
  );
}

export function useQueryKnowledgeData(filters: Filter[]): {
  knowledgeDBs: KnowledgeDBs;
  eose: boolean;
  allEventsProcessed: boolean;
} {
  const { relays, unpublishedEvents } = useData();
  const { relayPool, eventLoadingTimeout } = useApis();
  const [allEventsProcessed, setAllEventsProcessed] = useState(false);
  const setAllEventsProcessedTimeout = useRef<number | undefined>(undefined);

  const disabled = isOnlyDelete(filters);
  const { events, eose } = useEventQuery(relayPool, filters, {
    readFromRelays: relays,
    enabled: !disabled,
  });

  /**
   * Sometimes eose gets fired before all events are processed.
   *
   * This is a workaround to wait for all events to be processed before setting allEventsProcessed to true.
   * With dashboards with a lot of events a lot of time can pass between eose and the first
   * event being processed, therefore we need to select a huge timeout. User will see an
   * error message instead of the loading indicator if a note was not loaded by then.
   */
  useEffect(() => {
    if (!eose || disabled) {
      return;
    }
    clearTimeout(setAllEventsProcessedTimeout.current);
    // eslint-disable-next-line functional/immutable-data
    setAllEventsProcessedTimeout.current = setTimeout(() => {
      setAllEventsProcessed(true);
    }, eventLoadingTimeout) as unknown as number;
  }, [events.size, eose, JSON.stringify(filters), disabled]);

  const processedEvents = useEventProcessor(
    events.valueSeq().toList().merge(unpublishedEvents)
  );
  const knowledgeDBs = processedEvents.map((data) => data.knowledgeDB);
  return { knowledgeDBs, eose, allEventsProcessed };
}

export function LoadNode({
  children,
  waitForEose,
  referencedBy,
}: {
  children: React.ReactNode;
  waitForEose?: boolean;
  referencedBy?: boolean;
}): JSX.Element {
  const [nodeID] = useNodeID();
  const { user, contacts } = useData();

  const nodeFilter = addNodeToFilters(
    createBaseFilter(contacts, user.publicKey),
    nodeID
  );
  const filter = referencedBy
    ? addReferencedByToFilters(nodeFilter, nodeID)
    : nodeFilter;
  const filterArray = filtersToFilterArray(filter);
  const { knowledgeDBs, eose, allEventsProcessed } =
    useQueryKnowledgeData(filterArray);
  if (waitForEose === true && !eose) {
    return <div className="loading" aria-label="loading" />;
  }

  return (
    <RegisterQuery
      nodesBeeingQueried={extractNodesFromQueries(filterArray)}
      allEventsProcessed={allEventsProcessed}
    >
      <MergeKnowledgeDB knowledgeDBs={knowledgeDBs}>
        {children}
      </MergeKnowledgeDB>
    </RegisterQuery>
  );
}
