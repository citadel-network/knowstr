import { Filter, mergeFilters } from "nostr-tools";
import { List, Set } from "immutable";
import {
  KIND_DELETE,
  KIND_KNOWLEDGE_LIST,
  KIND_KNOWLEDGE_NODE,
  KIND_KNOWLEDGE_NODE_COLLECTION,
} from "./nostr";
import { joinID, splitID, stripIndex } from "./connections";
import { ViewPath, isSubPathWithRelations, parseViewPath } from "./ViewContext";

function addIDToFilter(filter: Filter, id: LongID, tag: `#${string}`): Filter {
  const d = filter[tag] || [];
  const local = splitID(id)[1];
  // TODO: Add unknown remotes? Or even better create a filter for each unknown remote to query specific ids
  // strip index form ID when we look for a node belonging to a collection
  const localID = filter.kinds?.includes(KIND_KNOWLEDGE_NODE_COLLECTION)
    ? stripIndex(local)
    : local;
  if (d.includes(localID)) {
    return filter;
  }
  return {
    ...filter,
    [tag]: [...d, localID],
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
  deleteFilter: Filter;
};

function walkPath(filters: Filters, p: ViewPath): Filters {
  const path = List(p);
  return path.reduce((rd, subPath): Filters => {
    const { nodeID } = subPath;
    return {
      knowledgeListbyID: isSubPathWithRelations(subPath)
        ? addIDToFilter(
            filters.knowledgeListbyID,
            subPath.relationsID as LongID,
            "#d"
          )
        : filters.knowledgeListbyID,
      knowledgeNodesByID: addIDToFilter(
        filters.knowledgeNodesByID,
        nodeID,
        "#d"
      ),
      knowledgeListByHead: addIDToFilter(
        filters.knowledgeListByHead,
        nodeID,
        "#k"
      ),
      deleteFilter: filters.deleteFilter,
    };
  }, filters);
}

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
    filters.deleteFilter,
  ].filter((f) => f !== undefined) as Filter[];
}

export function isFiltersQueryEnabled(filtersQuery: Filters): boolean {
  return (
    sanitizeFilter(filtersQuery.knowledgeListbyID, "#d") !== undefined ||
    sanitizeFilter(filtersQuery.knowledgeListByHead, "#k") !== undefined ||
    sanitizeFilter(filtersQuery.knowledgeNodesByID, "#d") !== undefined
  );
}

export function addNodeToFilters(filters: Filters, id: LongID): Filters {
  return {
    ...filters,
    knowledgeNodesByID: addIDToFilter(filters.knowledgeNodesByID, id, "#d"),
    knowledgeListByHead: addIDToFilter(filters.knowledgeListByHead, id, "#k"),
  };
}

function addWorkspaceToFilter(filters: Filters, id: LongID): Filters {
  return addNodeToFilters(filters, id);
}

export function adddWorkspacesToFilter(
  filters: Filters,
  workspaces: List<LongID>
): Filters {
  return workspaces.reduce((rdx, id) => addWorkspaceToFilter(rdx, id), filters);
}

function createBaseFilter(contacts: Contacts, myself: PublicKey): Filters {
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
    deleteFilter: {
      kinds: [KIND_DELETE],
      authors,
    },
  } as Filters;
}

export function buildPrimaryDataQueryFromViews(
  views: Views,
  myself: PublicKey,
  contacts: Contacts,
  activeWorkspace: LongID
): Filters {
  const baseFilter = createBaseFilter(contacts, myself);
  const baseFilterWithActiveWS = addWorkspaceToFilter(
    baseFilter,
    activeWorkspace
  );
  return views.reduce((rdx, view, key) => {
    const withRelation = {
      ...rdx,
      knowledgeListbyID: view.relations
        ? addIDToFilter(rdx.knowledgeListbyID, view.relations, "#d")
        : rdx.knowledgeListbyID,
    };
    const path = parseViewPath(key);
    if (path[0].nodeID !== activeWorkspace) {
      return withRelation;
    }
    return walkPath(withRelation, path);
  }, baseFilterWithActiveWS);
}

// Go through all relations and add all the items in them to the filter and also look for relations
// for those nodes
function addItemsFilter(data: KnowledgeData, filters: Filters): Filters {
  return data.relations.reduce((rdx, relation) => {
    const relationHeadLongId = joinID(
      splitID(relation.id)[0] || "",
      relation.head
    );
    const filtersWithReferencedNodesFilter = {
      ...rdx,
      knowledgeNodesByID: addIDToFilter(
        rdx.knowledgeNodesByID,
        relationHeadLongId,
        "#d"
      ),
      knowledgeListByHead: addIDToFilter(
        rdx.knowledgeListByHead,
        relationHeadLongId,
        "#k"
      ),
    };
    return relation.items.reduce((rd, item) => {
      return {
        knowledgeListbyID: rd.knowledgeListbyID,
        knowledgeNodesByID: addIDToFilter(rd.knowledgeNodesByID, item, "#d"),
        knowledgeListByHead: addIDToFilter(rd.knowledgeListByHead, item, "#k"),
        deleteFilter: rd.deleteFilter,
      };
    }, filtersWithReferencedNodesFilter);
  }, filters);
}

function removeDuplicates(
  filter: Filter,
  containsDuplicates: Filter,
  tag: `#${string}`
): Filter {
  const duplicates = containsDuplicates[tag] || [];
  const filtered = (filter[tag] || []).filter(
    (val) => !duplicates.includes(val)
  );
  return {
    ...filter,
    [tag]: filtered,
  };
}

// Going through all relations in the DB is an overkill, we should only go through the relations
// of the active workspace
// For example if a user switches workspaces, we will always query all relations of already visited
// workspaces
export function buildSecondaryDataQuery(
  knowledgeDBs: KnowledgeDBs,
  contacts: Contacts,
  myself: PublicKey,
  primaryFilters: Filters
): Filters {
  const filters = knowledgeDBs.reduce((rdx, db) => {
    return addItemsFilter(db, rdx);
  }, createBaseFilter(contacts, myself));
  return {
    knowledgeListbyID: removeDuplicates(
      filters.knowledgeListbyID,
      primaryFilters.knowledgeListbyID,
      "#d"
    ),
    knowledgeNodesByID: removeDuplicates(
      filters.knowledgeNodesByID,
      primaryFilters.knowledgeNodesByID,
      "#d"
    ),
    knowledgeListByHead: removeDuplicates(
      filters.knowledgeListByHead,
      primaryFilters.knowledgeListByHead,
      "#k"
    ),
    deleteFilter: filters.deleteFilter,
  };
}

function addRelationsToFilter(data: KnowledgeData, filter: Filter): Filter {
  return data.nodes.reduce((rdx, node) => {
    const d = rdx["#i"] || [];
    return {
      ...rdx,
      "#i": [...d, node.id],
    };
  }, filter);
}

export function buildReferencedByListsQuery(
  knowledgeDBs: KnowledgeDBs,
  contacts: Contacts,
  myself: PublicKey
): Filter {
  const authors = [...contacts.keySeq().toArray(), myself] as string[];
  return knowledgeDBs.reduce(
    (rdx: Filter, db) => {
      return addRelationsToFilter(db, rdx);
    },
    {
      kinds: [KIND_KNOWLEDGE_LIST],
      authors,
      "#i": [],
    }
  );
}

export function merge(a: Filters, b: Filters): Filters {
  return {
    knowledgeListbyID: mergeFilters(a.knowledgeListbyID, b.knowledgeListbyID),
    knowledgeNodesByID: mergeFilters(
      a.knowledgeNodesByID,
      b.knowledgeNodesByID
    ),
    knowledgeListByHead: mergeFilters(
      a.knowledgeListByHead,
      b.knowledgeListByHead
    ),
    deleteFilter: mergeFilters(a.deleteFilter, b.deleteFilter),
  };
}
