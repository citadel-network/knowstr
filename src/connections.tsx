import { List, Set } from "immutable";
import { v4 } from "uuid";
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

export const REFERENCED_BY = "referencedby" as LongID;

type ReferencedByHeadAndUpdated = Pick<Relations, "head" | "updated">;

export function getReferencedByRelations(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  nodeID: LongID | ID
): Relations | undefined {
  const rel = newRelations(nodeID, REFERENCED_BY, myself);
  const referencesOfAllDBs = knowledgeDBs.reduce((r, knowledgeDB) => {
    const relationsOfDB = knowledgeDB.relations.reduce((rdx, relations) => {
      if (relations.items.includes(nodeID)) {
        if (!rdx.find((item) => item.head === relations.head)) {
          return rdx.push({
            head: relations.head as LongID,
            updated: relations.updated,
          });
        }
      }
      return rdx;
    }, r);
    return r.merge(relationsOfDB);
  }, List<ReferencedByHeadAndUpdated>());
  const items = referencesOfAllDBs
    .filter(
      (relation, index, self) =>
        index === self.findIndex((t) => t.head === relation.head)
    )
    .sort((a, b) => a.updated - b.updated);
  return {
    ...rel,
    id: REFERENCED_BY,
    items: items.map((item) => item.head),
  };
}

export function getRelations(
  knowledgeDBs: KnowledgeDBs,
  relationID: ID | undefined,
  myself: PublicKey,
  nodeID: LongID | ID // for social lookup
): Relations | undefined {
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
  objectID: LongID | ID,
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
  objectIDs: Array<LongID | ID>,
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
