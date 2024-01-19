import { Map, List, Set } from "immutable";
import { Link } from "react-router-dom";
import { getNode, newDB } from "./knowledge";
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
  return nodes;
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

export function moveRelations(
  node: KnowNode,
  indices: Array<number>,
  startPosition: number,
  relationType: RelationType
): KnowNode {
  const relations = getRelations(node, relationType);
  const relationsToMove = relations.filter((_, i) => indices.includes(i));
  const updatedRelations = relations
    .filterNot((_, i) => indices.includes(i))
    .splice(startPosition, 0, ...relationsToMove.toArray());
  return {
    ...node,
    relations: node.relations.set(relationType, updatedRelations),
  };
}

export function addRelationToNode(
  node: KnowNode,
  objectID: string,
  relationType: RelationType,
  ord?: number
): KnowNode {
  const defaultOrder = getRelations(node, relationType).size;
  const relation = {
    id: objectID,
  };
  const subjectWithRelation = {
    ...node,
    relations: node.relations.set(
      relationType,
      getRelations(node, relationType).push(relation)
    ),
  };
  return ord !== undefined
    ? moveRelations(subjectWithRelation, [defaultOrder], ord, relationType)
    : subjectWithRelation;
}

export function bulkAddRelations(
  node: KnowNode,
  objectIDs: Array<string>,
  relationType: RelationType,
  startPos?: number
): KnowNode {
  return objectIDs.reduce((rdx, id, currentIndex) => {
    return addRelationToNode(
      rdx,
      id,
      relationType,
      startPos !== undefined ? startPos + currentIndex : undefined
    );
  }, node);
}

export function newNode(text: string, nodeType: NodeType): KnowNode {
  return {
    text,
    nodeType,
    relations: Map<RelationType, Relations>(),
  };
}
