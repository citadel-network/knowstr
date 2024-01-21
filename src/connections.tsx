import { Set } from "immutable";
import { v4 } from "uuid";
import { newDB } from "./knowledge";
import { getNodeFromID } from "./ViewContext";

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

export function getRelations(
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

// TODO: So far we only support local subjects
export function getSubjects(
  knowledgeDBs: KnowledgeDBs,
  nodeID: LongID,
  myself: PublicKey
): Nodes {
  const db = knowledgeDBs.get(myself, newDB());
  const relations = db.relations.filter((r) => r.items.includes(nodeID));
  const nodes = relations.map((r) =>
    getNodeFromID(knowledgeDBs, r.head, myself)
  );
  return nodes.filter((n) => n !== undefined) as Nodes;
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

export function newNode(text: string, myself: PublicKey): KnowNode {
  return {
    text,
    id: joinID(myself, v4()),
  };
}
