import React from "react";
import { List, Set, Map } from "immutable";
import { v4 } from "uuid";
import { getRelations, isRemote, joinID, splitID } from "./connections";
import { newDB } from "./knowledge";
import { useData } from "./DataContext";
import { Plan, planUpsertRelations, planUpdateViews } from "./planner";
import { planCopyRelationsTypeIfNecessary } from "./components/RelationTypes";

// only exported for tests
export type NodeIndex = number & { readonly "": unique symbol };

const ADD_TO_NODE = "ADD_TO_NODE" as LongID;

type SubPath = {
  nodeID: LongID;
  nodeIndex: NodeIndex;
};

type SubPathWithRelations = SubPath & {
  relationsID: ID;
};

export type ViewPath =
  | readonly [SubPath]
  | readonly [...SubPathWithRelations[], SubPath];

export const ViewContext = React.createContext<ViewPath | undefined>(undefined);

export function useViewPath(): ViewPath {
  const context = React.useContext(ViewContext);
  if (!context) {
    throw new Error("ViewContext not provided");
  }
  return context;
}

export function parseViewPath(path: string): ViewPath {
  const pieces = path.split(":");
  if (pieces.length < 2) {
    throw new Error("Invalid view path");
  }
  const nodeIndexEnd = parseInt(pieces[pieces.length - 1], 10) as NodeIndex;
  const nodeIdEnd = pieces[pieces.length - 2] as LongID;

  const beginning = pieces
    .slice(0, -2)
    .reduce(
      (
        acc: SubPathWithRelations[],
        piece,
        index,
        subPaths
      ): SubPathWithRelations[] => {
        if (index % 3 === 0) {
          const nodeID = piece as LongID;
          const indexValue = parseInt(subPaths[index + 1], 10) as NodeIndex;
          const relationID = subPaths[index + 2];
          return [
            ...acc,
            { nodeID, nodeIndex: indexValue, relationsID: relationID },
          ];
        }
        return acc;
      },
      []
    );
  return [...beginning, { nodeID: nodeIdEnd, nodeIndex: nodeIndexEnd }];
}

function convertViewPathToString(viewContext: ViewPath): string {
  const withoutLastElement = viewContext.slice(0, -1) as SubPathWithRelations[];
  const beginning = withoutLastElement.reduce(
    (acc: string, subPath: SubPathWithRelations): string => {
      const postfix = `${subPath.nodeID}:${subPath.nodeIndex}:${subPath.relationsID}`;
      return acc !== "" ? `${acc}:${postfix}` : postfix;
    },
    ""
  );
  const lastPath = viewContext[viewContext.length - 1];
  const end = `${lastPath.nodeID}:${lastPath.nodeIndex}`;
  return beginning !== "" ? `${beginning}:${end}` : end;
}

// TODO: delete this export
export const viewPathToString = convertViewPathToString;

function getViewExactMatch(views: Views, path: ViewPath): View | undefined {
  const viewKey = viewPathToString(path);
  return views.get(viewKey);
}

export function getAvailableRelationsForNode(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  id: LongID
): List<Relations> {
  const myRelations = knowledgeDBs.get(myself, newDB()).relations;
  const [remote] = splitID(id);
  const relations: List<Relations> = myRelations
    .filter((r) => r.head === id)
    .toList();

  const preferredRemoterelations: List<Relations> =
    remote && isRemote(remote, myself)
      ? knowledgeDBs
          .get(remote, newDB())
          .relations.filter((r) => r.head === id)
          .toList()
      : List<Relations>();
  const otherRelations: List<Relations> = knowledgeDBs
    .filter((_, k) => k !== myself && k !== remote)
    .map((db) => db.relations.filter((r) => r.head === id).toList())
    .toList()
    .flatten(1) as List<Relations>;
  return relations.concat(preferredRemoterelations).concat(otherRelations);
}

export function getDefaultRelationForNode(
  id: LongID,
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey
): LongID | undefined {
  return getAvailableRelationsForNode(knowledgeDBs, myself, id).first()?.id;
}

function getDefaultView(
  id: LongID,
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey
): View {
  return {
    relations: getDefaultRelationForNode(id, knowledgeDBs, myself),
    displaySubjects: false,
    width: 1,
    expanded: false,
  };
}

export function getNodeFromID(
  knowledgeDBs: KnowledgeDBs,
  id: ID,
  myself: PublicKey
): KnowNode | undefined {
  const [remote, knowID] = splitID(id);
  const db = knowledgeDBs.get(remote || myself, newDB());
  return db.nodes.get(knowID);
}

export function getLast(viewContext: ViewPath): SubPath {
  return viewContext[viewContext.length - 1];
}

export function getRoot(viewContext: ViewPath): SubPath | SubPathWithRelations {
  return viewContext[0];
}

export function getViewFromPath(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  views: Views, // get rid of this?
  path: ViewPath
): View {
  const { nodeID } = getLast(path);
  return (
    getViewExactMatch(views, path) ||
    getDefaultView(nodeID, knowledgeDBs, myself)
  );
}

export function getNodeFromView(
  knowledgeDBs: KnowledgeDBs,
  views: Views,
  myself: PublicKey,
  viewContext: ViewPath
): [KnowNode, View] | [undefined, undefined] {
  const view = getViewFromPath(knowledgeDBs, myself, views, viewContext);
  const { nodeID } = getLast(viewContext);
  const node = getNodeFromID(knowledgeDBs, nodeID, myself);
  if (!node) {
    return [undefined, undefined];
  }
  return [node, view];
}

export function getRelationsFromView(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  viewPath: ViewPath
): Relations | undefined {
  const { views } = knowledgeDBs.get(myself, newDB());
  const view = getViewFromPath(knowledgeDBs, myself, views, viewPath);
  return getRelations(
    knowledgeDBs,
    view.relations,
    myself,
    getLast(viewPath).nodeID
  );
}

export function calculateNodeIndex(
  relations: Relations,
  index: number
): NodeIndex {
  const item = relations.items.get(index);
  if (!item) {
    throw new Error(`No item found at index ${index}`);
  }
  // find same relation before this index
  return relations.items.slice(0, index).filter((i) => i === item)
    .size as NodeIndex;
}

export function calculateIndexFromNodeIndex(
  relations: Relations,
  node: LongID,
  nodeIndex: NodeIndex
): number {
  // Find the nth occurance of the node in the list
  const { items } = relations;
  const res = items.reduce(
    ([acc, found]: [number, boolean], item, idx): [number, boolean] => {
      if (found) {
        return [acc, true];
      }
      if (item === node) {
        if (acc === nodeIndex) {
          return [idx, true];
        }
        return [acc + 1, false];
      }
      return [acc, false];
    },
    [0, false]
  );
  if (res[1] === false) {
    throw new Error("Node not found in relations");
  }
  return res[0];
}

function addRelationsToLastElement(
  path: ViewPath,
  relationsID: LongID
): SubPathWithRelations[] {
  const pathWithoutParent = path.slice(0, -1) as SubPathWithRelations[];
  return [...pathWithoutParent, { ...getLast(path), relationsID }];
}

export function addAddToNodeToPath(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  path: ViewPath
): ViewPath {
  const relations = getRelationsFromView(knowledgeDBs, myself, path);
  if (!relations) {
    throw new Error("Parent doesn't have relations, cannot add to path");
  }
  // Assume there is only one Add to node per parent
  const nodeIndex = 0 as NodeIndex;
  return [
    ...addRelationsToLastElement(path, relations.id),
    { nodeID: ADD_TO_NODE, nodeIndex },
  ];
}

export function addNodeToPath(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  path: ViewPath,
  index: number
): ViewPath {
  const relations = getRelationsFromView(knowledgeDBs, myself, path);
  if (!relations) {
    throw new Error("Parent doesn't have relations, cannot add to path");
  }
  const nodeID = relations.items.get(index);
  if (!nodeID) {
    // eslint-disable-next-line no-console
    console.error("No node found in relations", relations, " at index", index);
    throw new Error("No node found in relation at index");
  }
  const nodeIndex = calculateNodeIndex(relations, index);
  const pathWithRelations = addRelationsToLastElement(path, relations.id);
  return [...pathWithRelations, { nodeID, nodeIndex }];
}

function popPath(viewContext: ViewPath): ViewPath | undefined {
  const pathWithoutLast = viewContext.slice(0, -1) as SubPathWithRelations[];
  const parent = pathWithoutLast[pathWithoutLast.length - 1];
  if (!parent) {
    return undefined;
  }
  return [
    ...pathWithoutLast.slice(0, -1),
    { nodeID: parent.nodeID, nodeIndex: parent.nodeIndex },
  ];
}

export function getRelationIndex(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  viewPath: ViewPath
): number | undefined {
  const { nodeIndex, nodeID } = getLast(viewPath);
  const parentPath = popPath(viewPath);
  if (!parentPath) {
    return undefined;
  }
  const relations = getRelationsFromView(knowledgeDBs, myself, parentPath);
  if (!relations) {
    return undefined;
  }
  if (nodeID === ADD_TO_NODE) {
    return relations.items.size;
  }
  return calculateIndexFromNodeIndex(relations, nodeID, nodeIndex);
}

export function useRelationIndex(): number | undefined {
  const path = useViewPath();
  const { knowledgeDBs, user } = useData();
  return getRelationIndex(knowledgeDBs, user.publicKey, path);
}

export function RootViewContextProvider({
  children,
  root,
  indices,
}: {
  children: React.ReactNode;
  root: LongID;
  indices?: List<number>;
}): JSX.Element {
  const { knowledgeDBs, user } = useData();
  const startPath: ViewPath = [{ nodeID: root, nodeIndex: 0 as NodeIndex }];
  const finalPath = (indices || List<number>()).reduce(
    (acc, index) => addNodeToPath(knowledgeDBs, user.publicKey, acc, index),
    startPath
  );
  return (
    <ViewContext.Provider value={finalPath}>{children}</ViewContext.Provider>
  );
}

export function PushNode({
  children,
  push,
}: {
  children: React.ReactNode;
  push: List<number>;
}): JSX.Element {
  const { knowledgeDBs, user } = useData();
  const existingPath = useViewPath();
  const finalPath = push.reduce(
    (acc, index) => addNodeToPath(knowledgeDBs, user.publicKey, acc, index),
    existingPath
  );
  return (
    <ViewContext.Provider value={finalPath}>{children}</ViewContext.Provider>
  );
}

export function useNode(): [KnowNode, View] | [undefined, undefined] {
  const viewContext = useViewPath();
  const { knowledgeDBs, user } = useData();
  const { views } = knowledgeDBs.get(user.publicKey, newDB());
  return getNodeFromView(knowledgeDBs, views, user.publicKey, viewContext);
}

export function getParentNode(
  knowledgeDBs: KnowledgeDBs,
  views: Views,
  myself: PublicKey,
  viewContext: ViewPath
): [KnowNode, View] | [undefined, undefined] {
  const path = popPath(viewContext);
  if (!path) {
    return [undefined, undefined];
  }
  return getNodeFromView(knowledgeDBs, views, myself, path);
}

export function useParentNode(): [KnowNode, View] | [undefined, undefined] {
  const viewContext = useViewPath();
  const { knowledgeDBs, user } = useData();
  const { views } = knowledgeDBs.get(user.publicKey, newDB());
  return getParentNode(knowledgeDBs, views, user.publicKey, viewContext);
}

export function useIsAddToNode(): boolean {
  const viewContext = useViewPath();
  return getLast(viewContext).nodeID === ADD_TO_NODE;
}

export function useViewKey(): string {
  return viewPathToString(useViewPath());
}

export function getParentKey(viewKey: string): string {
  return viewKey.split(":").slice(0, -3).join(":");
}

export function getParentView(viewContext: ViewPath): ViewPath | undefined {
  return popPath(viewContext);
}

export function popPrefix(viewKey: string): [string, string] {
  const prefix = viewKey.split(":")[0];
  // eslint-disable-next-line functional/immutable-data
  const key = viewKey.split(":").splice(1).join(":");
  return [prefix, key];
}

export function updateView(views: Views, path: ViewPath, view: View): Views {
  return views.set(viewPathToString(path), view);
}

export function deleteChildViews(views: Views, path: ViewPath): Views {
  const key = viewPathToString(path);
  return views.filter((v, k) => !k.startsWith(key) || k === key);
}

export function newRelations(
  head: LongID,
  type: ID,
  myself: PublicKey
): Relations {
  return {
    head,
    items: List<LongID>(),
    id: joinID(myself, v4()),
    type,
    updated: Math.floor(Date.now() / 1000),
  };
}

function createUpdatableRelations(
  knowledgeDBs: KnowledgeDBs,
  viewContext: ViewPath,
  myself: PublicKey,
  relationsID: ID,
  head: LongID,
  relationTypeID: ID
): Relations {
  const [remote, id] = splitID(relationsID);
  if (relationsID === "social" || (remote && isRemote(remote, myself))) {
    // copy remote or social relations
    const remoteRelations = getRelations(
      knowledgeDBs,
      relationsID,
      myself,
      head
    );
    if (!remoteRelations) {
      // This should not happen
      return newRelations(head, relationTypeID, myself);
    }
    // Make a copy
    return {
      ...remoteRelations,
      type: remoteRelations.type === "social" ? "" : remoteRelations.type,
      id: joinID(myself, v4()),
    };
  }
  return knowledgeDBs
    .get(myself, newDB())
    .relations.get(id, newRelations(head, relationTypeID, myself));
}

export function upsertRelations(
  plan: Plan,
  viewContext: ViewPath,
  modify: (relations: Relations, ctx: { view: View }) => Relations
): Plan {
  const { views } = plan.knowledgeDBs.get(plan.user.publicKey, newDB());
  const [node, nodeView] = getNodeFromView(
    plan.knowledgeDBs,
    views,
    plan.user.publicKey,
    viewContext
  );
  if (!node || !nodeView) {
    // eslint-disable-next-line no-console
    console.error("Node or View not found", node, nodeView);
    throw new Error("Nothing to update");
  }
  // create new relations if this node doesn't have any
  const relationsID = nodeView.relations || v4();
  const relations = createUpdatableRelations(
    plan.knowledgeDBs,
    viewContext,
    plan.user.publicKey,
    relationsID,
    node.id,
    "" // TODO: relation type?
  );

  // TODO: check if this is different than the default
  const didViewChange = nodeView.relations !== relations.id;
  const planWithUpdatedView = didViewChange
    ? planUpdateViews(
        plan,
        views.set(viewPathToString(viewContext), {
          ...nodeView,
          relations: relations.id,
        })
      )
    : plan;

  const updatedRelations = modify(relations, { view: nodeView });
  return planUpsertRelations(
    planCopyRelationsTypeIfNecessary(planWithUpdatedView, relationsID),
    updatedRelations
  );
}

/*
 * input for example
 * ws:0:2:0
 *
 * returns
 * ws
 * ws:0
 * ws:0:2
 * ws:0:2:0
 * */
function getAllSubpaths(path: string): Set<string> {
  return path.split(":").reduce((acc, p) => {
    const lastPath = acc.last(undefined);
    return acc.add(lastPath ? `${lastPath}:${p}` : `${p}`);
  }, Set<string>());
}

function findViewsForRepo(
  knowledgeDBs: KnowledgeDBs,
  views: Views,
  myself: PublicKey,
  id: string,
  relationsID: ID
): Set<string> {
  // include partial, non existing views
  const paths = views.reduce((acc, _, path) => {
    return acc.merge(getAllSubpaths(path));
  }, Set<string>());
  return paths.filter((path) => {
    try {
      const [node, view] = getNodeFromView(
        knowledgeDBs,
        views,
        myself,
        parseViewPath(path)
      );
      return node && node.id === id && view.relations === relationsID;
    } catch {
      // Some view paths lead to nowhere
      return false;
    }
  });
}

function updateRelationViews(
  views: Views,
  parentViewPath: string,
  update: (relations: List<string | undefined>) => List<string | undefined>
): Views {
  const childPaths = views
    .keySeq()
    .toList()
    .filter((path) => path.startsWith(`${parentViewPath}:`));

  /*
   * ws:0:1 => ws:0:2
   * ws:0:2 => ws:0:3
   * ws:0:2:0 => ws:0:3:0
   * ws:0:2:1 => ws:0:3:1
   */

  const toReplace = childPaths.reduce((acc, path) => {
    // Figure out the which index position this relationship has to the parent
    const subpath = path.substring(parentViewPath.length + 1);
    const index = parseInt(subpath.split(":")[0], 10);
    return acc.set(index, `${parentViewPath}:${index}`);
  }, List<string | undefined>([]));
  const updatedPositions = update(toReplace);
  const replaceWith = updatedPositions.reduce((acc, replaceString, newPos) => {
    if (replaceString === undefined) {
      return acc;
    }
    const replaceW = `${parentViewPath}:${newPos}`;
    return acc.set(replaceString, replaceW);
  }, Map<string, string>());

  return views.mapEntries(([path, view]) => {
    if (path.length <= parentViewPath.length) {
      return [path, view];
    }
    const subpath = path.substring(parentViewPath.length + 1);
    const index = parseInt(subpath.split(":")[0], 10);
    const replace = `${parentViewPath}:${index}`;
    const w = replaceWith.get(replace);
    if (w === undefined) {
      return [path, view];
    }
    return [path.replace(replace, w), view];
  });
}

function moveChildViews(
  views: Views,
  parentViewPath: string,
  indices: Array<number>,
  startPosition: number
): Views {
  return updateRelationViews(views, parentViewPath, (relations) => {
    const viewsToMove = List<string | undefined>(
      indices.map((i) => relations.get(i))
    );
    return relations
      .filterNot((_, i) => indices.includes(i))
      .splice(startPosition, 0, ...viewsToMove.toArray());
  });
}

export function updateViewPathsAfterMoveRelations(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  repoPath: ViewPath,
  indices: Array<number>,
  startPosition?: number
): Views {
  // nothing to do
  const { views } = knowledgeDBs.get(myself, newDB());
  if (startPosition === undefined) {
    return views;
  }
  const [node, view] = getNodeFromView(knowledgeDBs, views, myself, repoPath);
  if (!node || !view.relations) {
    return views;
  }
  const viewKeys = findViewsForRepo(
    knowledgeDBs,
    views,
    myself,
    node.id,
    view.relations
  );
  const sortedViewKeys = viewKeys.sort(
    (a, b) => b.split(":").length - a.split(":").length
  );
  return sortedViewKeys.reduce((accViews, parentViewPath) => {
    return moveChildViews(accViews, parentViewPath, indices, startPosition);
  }, views);
}

export function updateViewPathsAfterAddRelation(
  knowledgeDBs: KnowledgeDBs,
  views: Views,
  myself: PublicKey,
  repoPath: ViewPath,
  ord?: number
): Views {
  // nothing to do
  if (ord === undefined) {
    return views;
  }
  const [node, view] = getNodeFromView(knowledgeDBs, views, myself, repoPath);
  if (!node || !view.relations) {
    return views;
  }
  const viewKeys = findViewsForRepo(
    knowledgeDBs,
    views,
    myself,
    node.id,
    view.relations
  );

  const sortedViewKeys = viewKeys.sort(
    (a, b) => b.split(":").length - a.split(":").length
  );

  return sortedViewKeys.reduce((accViews, parentViewPath) => {
    const childPaths = accViews
      .keySeq()
      .toList()
      .filter((path) => path.startsWith(parentViewPath));

    const lastChildIndex =
      (childPaths
        // eslint-disable-next-line functional/immutable-data
        .map((path) => parseInt(path.split(":").pop() as string, 10))
        .max() as number) + 1;

    const indices = [lastChildIndex];
    const startPosition = ord;
    return moveChildViews(accViews, parentViewPath, indices, startPosition);
  }, views);
}

export function updateViewPathsAfterDeleteNode(
  views: Views,
  nodeID: LongID
): Views {
  return views.filterNot((_, k) => k.includes(nodeID));
}

/*
 * A:R:2:B:R2:2 -> A:R:1:B:R2:2
 * A:R2:1:B:R:2 -> A:R2:1:B:R:1
 * C:R:0 -> C:R:0
 * A:R:2:B:R:2 -> A:R:1:B:R:1
 * R:1:R:2 -> deleted
 * A:R2:1:B:R:1 -> deleted
 */

function alterPath(
  viewPath: string,
  calcIndex: (relation: LongID, node: LongID, index: NodeIndex) => NodeIndex
): string {
  const paths = viewPath.split(":");
  return paths
    .map((path, idx) => {
      // The first two values are root:0
      if (idx >= 4 && (idx - 1) % 3 === 0) {
        const relation = paths[idx - 2] as LongID;
        const node = paths[idx - 1] as LongID;
        const index = parseInt(paths[idx], 10) as NodeIndex;
        return calcIndex(relation, node, index);
      }
      return path;
    })
    .join(":");
}

export function updateViewPathsAfterDisconnect(
  views: Views,
  disconnectNode: LongID,
  fromRelation: LongID,
  nodeIndex: NodeIndex
): Views {
  // If I delete A:0, A:1 will be A:0, A:2 will be A:1 ...
  const toDelete = `${fromRelation}:${disconnectNode}:${nodeIndex}`;
  const withDeleted = views.filterNot(
    (_, k) => k.includes(`${toDelete}:`) || k.endsWith(toDelete)
  );

  const lookForPrefix = `${fromRelation}:${disconnectNode}:`;

  return withDeleted.mapKeys((key) => {
    if (!key.includes(lookForPrefix)) {
      return key;
    }
    return alterPath(key, (relation, node, index) => {
      if (
        relation === fromRelation &&
        node === disconnectNode &&
        index > nodeIndex
      ) {
        return (index - 1) as NodeIndex;
      }
      return index;
    });
  });
}

export function bulkUpdateViewPathsAfterAddRelation(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  repoPath: ViewPath,
  nAdds: number,
  startPos?: number
): Views {
  const { views } = knowledgeDBs.get(myself, newDB());
  return List<undefined>([])
    .set(nAdds - 1, undefined)
    .reduce((rdx, i, currentIndex) => {
      return updateViewPathsAfterAddRelation(
        knowledgeDBs,
        views,
        myself,
        repoPath,
        startPos !== undefined ? startPos + currentIndex : undefined
      );
    }, views);
}
