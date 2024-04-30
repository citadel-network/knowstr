import React from "react";
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

export function useQueryKnowledgeData(filters: Filters): {
  knowledgeDBs: KnowledgeDBs;
  eose: boolean;
} {
  const { relays, unpublishedEvents } = useData();
  const { relayPool } = useApis();

  const { events, eose } = useEventQuery(
    relayPool,
    filtersToFilterArray(filters),
    { readFromRelays: relays }
  );
  // TODO: optimization to only process unpublishedEvents matching the filters
  const processedEvents = useEventProcessor(
    events.valueSeq().toList().merge(unpublishedEvents)
  );
  const knowledgeDBs = processedEvents.map((data) => data.knowledgeDB);
  return { knowledgeDBs, eose };
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
  const { knowledgeDBs, eose } = useQueryKnowledgeData(filter);
  if (waitForEose === true && !eose) {
    return <div className="loading" aria-label="loading" />;
  }

  return (
    <MergeKnowledgeDB knowledgeDBs={knowledgeDBs}>{children}</MergeKnowledgeDB>
  );
}
