import { Map, List, Set } from "immutable";
import { getNode } from "./knowledge";

function hasRelationToObject(node: KnowNode, objectID: string): boolean {
  return (
    node.relations.filter((m) => m.filter((r) => r.id === objectID).size > 0)
      .size > 0
  );
}

export function getRelations(
  node: KnowNode,
  relationType: RelationType
): List<Relation> {
  return node.relations.get(relationType, List<Relation>());
}

export function getSubjects(
  repos: Repos,
  repoID: string,
  filter?: Array<NodeType>
): Repos {
  return repos.filter(
    (r) =>
      hasRelationToObject(getNode(r), repoID) &&
      (filter === undefined ? true : filter.includes(getNode(r).nodeType))
  );
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
