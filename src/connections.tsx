import { Set } from "immutable";
import { v4 } from "uuid";
import { newDB } from "./knowledge";
import { newRelations } from "./ViewContext";

export function splitID(id: ID): [PublicKey | undefined, string] {
  const split = id.split("_");
  if (split.length === 1) {
    return [undefined, split[0]];
  }
  return [split[0] as PublicKey, split.slice(1).join(":")];
}

export function joinID(remote: PublicKey | string, id: string): LongID {
  return `${remote}_${id}` as LongID;
}

export function shortID(id: ID): string {
  return splitID(id)[1];
}

export function stripIndex(id: string): string {
  if (id.includes("#")) {
    return id.split("#")[0];
  }
  return id;
}

export function getRelationsNoSocial(
  knowledgeDBs: KnowledgeDBs,
  relationID: ID | undefined,
  myself: PublicKey
): Relations | undefined {
  if (!relationID) {
    return undefined;
  }
  const [remote, id] = splitID(relationID);
  if (remote) {
    return knowledgeDBs.get(remote)?.relations.get(id);
  }
  const res = knowledgeDBs.get(myself)?.relations.get(relationID);
  return res;
}

function getAllRelationsForNode(
  knowledgeDB: KnowledgeData,
  nodeID: LongID
): Set<LongID> {
  const localID = shortID(nodeID);
  return knowledgeDB.relations.reduce((rdx, relations) => {
    if (relations.head === localID) {
      return rdx.merge(relations.items);
    }
    return rdx;
  }, Set<LongID>());
}

export function getSocialRelations(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  nodeID: LongID // for social lookup
): Relations | undefined {
  // Combines all items from other users we don't have in our Lists
  const myRelationsForNode = getAllRelationsForNode(
    knowledgeDBs.get(myself, newDB()),
    nodeID
  );

  const otherRelationsForNode = knowledgeDBs.reduce((rdx, knowledgeDB) => {
    return rdx.merge(getAllRelationsForNode(knowledgeDB, nodeID));
  }, Set<LongID>());

  const myShortIds = myRelationsForNode.map((id) => shortID(id)[1]);

  const items = otherRelationsForNode.filter(
    (id) => !myShortIds.has(shortID(id)[1])
  );
  return {
    updated: Math.floor(Date.now() / 1000),
    items: items.toList(),
    head: nodeID,
    id: "social" as LongID,
    type: "social",
  };
}

export const REFERENCED_BY = "referenced_by" as ID;

export function getReferencedByRelations(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  nodeID: LongID
): Relations | undefined {
  const rel = newRelations(nodeID, REFERENCED_BY, myself);
  const items = knowledgeDBs.reduce((r, knowledgeDB, author) => {
    return knowledgeDB.relations.reduce((rdx, relations) => {
      if (relations.items.includes(nodeID)) {
        return rdx.push(joinID(author, relations.head));
      }
      return rdx;
    }, r);
  }, rel.items);
  return {
    ...rel,
    id: REFERENCED_BY as LongID,
    items,
  };
}

export function getRelations(
  knowledgeDBs: KnowledgeDBs,
  relationID: ID | undefined,
  myself: PublicKey,
  nodeID: LongID // for social lookup
): Relations | undefined {
  if (relationID === "social") {
    return getSocialRelations(knowledgeDBs, myself, nodeID);
  }
  if (relationID === REFERENCED_BY) {
    return getReferencedByRelations(knowledgeDBs, myself, nodeID);
  }
  return getRelationsNoSocial(knowledgeDBs, relationID, myself);
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

export function isIDRemote(id: ID, myself: PublicKey): boolean {
  return isRemote(splitID(id)[0], myself);
}

export function moveRelations(
  relations: Relations,
  indices: Array<number>,
  startPosition: number
): Relations {
  const itemsToMove = relations.items.filter((_, i) => indices.includes(i));
  const updatedItems = relations.items
    .filterNot((_, i) => indices.includes(i))
    .splice(startPosition, 0, ...itemsToMove.toArray());
  return {
    ...relations,
    items: updatedItems,
  };
}

export function addRelationToRelations(
  relations: Relations,
  objectID: LongID,
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
  objectIDs: Array<LongID>,
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
    id: joinID(myself, id || v4()),
  };
}
