import { Set } from "immutable";
import { v4 } from "uuid";
import { newDB } from "./knowledge";
import { newRelations } from "./ViewContext";

export function newID(): ID {
  return v4() as ID;
}

function getRelationsFromDB(
  knowledgeDBs: KnowledgeDBs,
  relationID: ID
): Relations | undefined {
  return knowledgeDBs
    .map((db) => db.relations.get(relationID))
    .filter((r) => r !== undefined)
    .first();
}

export function getNodeFromDB(
  knowledgeDBs: KnowledgeDBs,
  nodeID: ID
): KnowNode | undefined {
  return knowledgeDBs
    .map((db) => db.nodes.get(nodeID))
    .filter((n) => n !== undefined)
    .first();
}

export function getRelationsNoSocial(
  knowledgeDBs: KnowledgeDBs,
  relationID: ID | undefined
): Relations | undefined {
  if (!relationID) {
    return undefined;
  }
  return getRelationsFromDB(knowledgeDBs, relationID);
}

function getAllItemsFromRelationsToNode(
  knowledgeDB: KnowledgeData,
  nodeID: ID
): Set<ID> {
  return knowledgeDB.relations.reduce((rdx, relations) => {
    if (relations.head === nodeID) {
      return rdx.merge(relations.items);
    }
    return rdx;
  }, Set<ID>());
}

export function getSocialRelations(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  nodeID: ID // for social lookup
): Relations | undefined {
  // Combines all items from other users we don't have in our Lists
  const myRelationsForNode = getAllItemsFromRelationsToNode(
    knowledgeDBs.get(myself, newDB()),
    nodeID
  );

  const otherRelationsForNode = knowledgeDBs.reduce((rdx, knowledgeDB) => {
    return rdx.merge(getAllItemsFromRelationsToNode(knowledgeDB, nodeID));
  }, Set<ID>());

  const items = otherRelationsForNode.filter(
    (id) => !myRelationsForNode.has(id)
  );
  return {
    updated: Math.floor(Date.now() / 1000),
    items: items.toList(),
    head: nodeID,
    id: "social" as ID,
    type: "social" as ID,
    author: "" as PublicKey,
  };
}

export const REFERENCED_BY = "referencedby" as ID;

export function getReferencedByRelations(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  nodeID: ID
): Relations | undefined {
  const rel = newRelations(nodeID, REFERENCED_BY, myself);
  const items = knowledgeDBs.reduce((r, knowledgeDB) => {
    return knowledgeDB.relations.reduce((rdx, relations) => {
      if (relations.items.includes(nodeID)) {
        return rdx.push(relations.head);
      }
      return rdx;
    }, r);
  }, rel.items);
  return {
    ...rel,
    id: REFERENCED_BY,
    items: items.toSet().toList(),
  };
}

export function isVirtualRelationsType(relationID: ID): boolean {
  return relationID === "social" || relationID === REFERENCED_BY;
}

export function getRelations(
  knowledgeDBs: KnowledgeDBs,
  relationID: ID | undefined,
  myself: PublicKey,
  nodeID: ID // for social lookup
): Relations | undefined {
  if (relationID === "social") {
    return getSocialRelations(knowledgeDBs, myself, nodeID);
  }
  if (relationID === REFERENCED_BY) {
    return getReferencedByRelations(knowledgeDBs, myself, nodeID);
  }
  return getRelationsNoSocial(knowledgeDBs, relationID);
}

export function deleteRelations(
  relations: Relations,
  indices: Set<number>
): Relations {
  const items = indices
    .sortBy((index) => -index)
    .reduce((r, deleteIndex) => r.delete(deleteIndex), relations.items);
  return {
    ...relations,
    items,
  };
}

export function isRemote(
  remote: PublicKey | undefined,
  myself: PublicKey
): boolean {
  return remote !== undefined && remote !== myself;
}

export function moveRelations(
  relations: Relations,
  indices: Array<number>,
  startPosition: number
): Relations {
  const itemsToMove = relations.items.filter((_, i) => indices.includes(i));
  const itemsBeforeStartPos = indices.filter((i) => i < startPosition).length;
  const updatedItems = relations.items
    .filterNot((_, i) => indices.includes(i))
    .splice(startPosition - itemsBeforeStartPos, 0, ...itemsToMove.toArray());
  return {
    ...relations,
    items: updatedItems,
  };
}

export function addRelationToRelations(
  relations: Relations,
  objectID: ID,
  ord?: number
): Relations {
  const defaultOrder = relations.items.size;
  const items = relations.items.push(objectID);
  const relationsWithItems = {
    ...relations,
    items,
  };
  return ord !== undefined
    ? moveRelations(relationsWithItems, [defaultOrder], ord)
    : relationsWithItems;
}

export function bulkAddRelations(
  relations: Relations,
  objectIDs: Array<ID>,
  startPos?: number
): Relations {
  return objectIDs.reduce((rdx, id, currentIndex) => {
    return addRelationToRelations(
      rdx,
      id,
      startPos !== undefined ? startPos + currentIndex : undefined
    );
  }, relations);
}

export function newNode(text: string, myself: PublicKey, id?: ID): KnowNode {
  return {
    text,
    id: id || newID(),
    author: myself,
  };
}
