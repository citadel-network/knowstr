import { Map, Set } from "immutable";
import { v4 } from "uuid";
import { newDB } from "./knowledge";
import { relationsMapToJSON } from "./serializer";

export function splitID(id: ID): [PublicKey | undefined, string] {
  const split = id.split(":");
  if (split.length === 1) {
    return [undefined, split[0]];
  }
  return [split[0] as PublicKey, split.slice(1).join(":")];
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
  return knowledgeDBs.get(myself)?.relations.get(relationID);
}

// TODO: So far we only support local subjects
export function getSubjects(
  knowledgeDBs: KnowledgeDBs,
  nodeID: string,
  myself: PublicKey
): Nodes {
  const db = knowledgeDBs.get(myself, newDB());
  const relations = db.relations.filter((r) => r.items.includes(nodeID));
  const nodes = relations.map((r) => db.nodes.get(r.head));
  return nodes.filter((n) => n !== undefined) as Nodes;
}

export function deleteRelationsFromNode(
  node: KnowNode,
  indices: Set<number>,
  relationType: RelationType
): KnowNode {
  const relations = indices
    .sortBy((index) => -index)
    .reduce(
      (r, deleteIndex) => r.delete(deleteIndex),
      getRelations(node, relationType)
    );
  return {
    ...node,
    relations: node.relations.set(relationType, relations),
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
  objectID: string,
  ord?: number
): Relations {
  const defaultOrder = relations.items.size;
  const items = relations.items.push(objectID);
  const itemsWithOrder =
    ord !== undefined
      ? moveRelations(relations, [defaultOrder], ord).items
      : items;
  return {
    ...relations,
    items: itemsWithOrder,
  };
}

export function bulkAddRelations(
  relations: Relations,
  objectIDs: Array<string>,
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

export function newNode(text: string): KnowNode {
  return {
    text,
    id: v4(),
  };
}
