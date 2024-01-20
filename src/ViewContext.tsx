import React from "react";
import { List, Set, Map } from "immutable";
import { v4 } from "uuid";
import { getRelations, getSubjects, isRemote, splitID } from "./connections";
import { newDB } from "./knowledge";
import { useData } from "./DataContext";
import { Plan, planUpdateRelations, planUpdateViews } from "./planner";

export type ViewPath = {
  root: string;
  // objects + subjects
  indexStack: List<number>;
};

const ViewContext = React.createContext<ViewPath | undefined>(undefined);

export function ViewContextProvider({
  children,
  root,
  indices,
}: {
  children: React.ReactNode;
  root: string;
  indices?: List<number>;
}): JSX.Element {
  return (
    <ViewContext.Provider
      value={{
        root,
        indexStack: indices || List<number>(),
      }}
    >
      {children}
    </ViewContext.Provider>
  );
}

export function useViewPath(): ViewPath {
  const context = React.useContext(ViewContext);
  if (!context) {
    throw new Error("ViewContext not provided");
  }
  return context;
}

export function PushViewIndex({
  children,
  push,
}: {
  children: React.ReactNode;
  push: List<number>;
}): JSX.Element {
  const existingContext = useViewPath();
  return (
    <ViewContext.Provider
      value={{
        root: existingContext.root,
        indexStack: existingContext.indexStack.concat(push),
      }}
    >
      {children}
    </ViewContext.Provider>
  );
}

export function viewPathToString(viewContext: ViewPath): string {
  return `${viewContext.root}${
    viewContext.indexStack.size > 0 ? ":" : ""
  }${viewContext.indexStack.toArray().join(":")}`;
}

export function getViewExactMatch(
  views: Views,
  path: ViewPath
): View | undefined {
  const viewKey = viewPathToString(path);
  return views.get(viewKey);
}

function getDefaultRelationForNode(
  id: ID,
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey
): ID | undefined {
  // Do I have relations in my database?
  const myRelations = knowledgeDBs.get(myself, newDB()).relations;
  const [remote, knowID] = splitID(id);
  const relations = myRelations.filter((r) => r.head === knowID);
  // TODO: sort relations
  if (relations.size > 0) {
    return relations.keySeq().first("");
  }
  if (remote) {
    const remoteRelations = knowledgeDBs
      .get(remote, newDB())
      .relations.filter((r) => r.head === knowID);
    if (remoteRelations.size > 0) {
      const relationID = remoteRelations.keySeq().first("");
      return `${remote}/${relationID}`;
    }
  }
  // TODO: Find any other relation
  // see if there are any relations in any of the databases
  // if not, return undefined
  // const withRelations = knowledgeDBs.map((db, publicKey) => db.relations.filter(r => r.head === knowID));
  //  withRelations.filter(r => r.size > 0).map(relations => relations.first());
  return undefined;
}

export function getDefaultView(
  id: ID,
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

function getNodeFromID(
  knowledgeDBs: KnowledgeDBs,
  id: ID,
  myself: PublicKey
): KnowNode | undefined {
  const [remote, knowID] = splitID(id);
  const db = knowledgeDBs.get(remote || myself, newDB());
  return db.nodes.get(knowID);
}

function getKnowNode(
  knowledgeDBs: KnowledgeDBs,
  views: Views,
  myself: PublicKey,
  rootID: ID,
  root: KnowNode,
  indices: List<number>,
  startPath: ViewPath
): [KnowNode, View] {
  const view =
    getViewExactMatch(views, startPath) ||
    getDefaultView(rootID, knowledgeDBs, myself);
  const index = indices.get(0);
  if (index === undefined) {
    return [root, view];
  }

  const relations = getRelations(knowledgeDBs, view.relations, myself);
  const items = relations?.items || List<ID>();
  if (index === items.size) {
    throw new Error(
      `View path index reserved for AddNodeButton. No repo found ${viewPathToString(
        {
          root: startPath.root,
          indexStack: indices,
        }
      )}`
    );
  }
  if (index > items.size) {
    const subjectEntries = getSubjects(knowledgeDBs, root.id, myself).toArray();
    const subjectEntry = subjectEntries[index - items.size - 1];
    if (!subjectEntry) {
      throw new Error(
        `No Node for view path found ${viewPathToString({
          root: startPath.root,
          indexStack: indices,
        })}`
      );
    }
    const subject = subjectEntry[1];
    if (!subject) {
      throw new Error("Subject does not exist");
    }
    // TODO: so far subject is only local there fore I can use subject.id here
    return getKnowNode(
      knowledgeDBs,
      views,
      myself,
      subject.id,
      subject,
      indices.remove(0),
      {
        root: startPath.root,
        indexStack: startPath.indexStack.push(index),
      }
    );
  }
  const objectID = items.get(index);
  if (!objectID) {
    throw new Error("Wrong path");
  }
  // TODO: we need to check if the relation is local or remote
  const obj = getNodeFromID(knowledgeDBs, objectID, myself);
  if (!obj) {
    throw new Error(`Object ${objectID} does not exist`);
  }
  return getKnowNode(
    knowledgeDBs,
    views,
    myself,
    objectID,
    obj,
    indices.remove(0),
    {
      root: startPath.root,
      indexStack: startPath.indexStack.push(index),
    }
  );
}

export function useRelationIndex(): number | undefined {
  const viewContext = useViewPath();
  return viewContext.indexStack.last();
}

export function getNodeFromView(
  knowledgeDBs: KnowledgeDBs,
  views: Views,
  myself: PublicKey,
  viewContext: ViewPath
): [KnowNode, View] | [undefined, undefined] {
  const root = getNodeFromID(knowledgeDBs, viewContext.root, myself);
  if (!root) {
    return [undefined, undefined];
  }
  const rootViewPath = { root: root.id, indexStack: List<number>() };
  try {
    return getKnowNode(
      knowledgeDBs,
      views,
      myself,
      viewContext.root,
      root,
      viewContext.indexStack,
      rootViewPath
    );
  } catch {
    return [undefined, undefined];
  }
}

export function useNode(): [KnowNode, View] | [undefined, undefined] {
  const viewContext = useViewPath();
  const { knowledgeDBs, user } = useData();
  const { views } = knowledgeDBs.get(user.publicKey, newDB());
  return getNodeFromView(knowledgeDBs, views, user.publicKey, viewContext);
}

export function getParentRepo(
  knowledgeDBs: KnowledgeDBs,
  views: Views,
  myself: PublicKey,
  viewContext: ViewPath
): [KnowNode, View] | [undefined, undefined] {
  const lastIndex = viewContext.indexStack.last();
  const rootID = viewContext.root;
  const root = getNodeFromID(knowledgeDBs, rootID, myself);
  if (lastIndex === undefined || !root) {
    return [undefined, undefined];
  }
  return getKnowNode(
    knowledgeDBs,
    views,
    myself,
    rootID,
    root,
    viewContext.indexStack.pop(),
    {
      root: root.id,
      indexStack: List<number>(),
    }
  );
}

export function useParentRepo(): [KnowNode, View] | [undefined, undefined] {
  const viewContext = useViewPath();
  const { knowledgeDBs, user } = useData();
  const { views } = knowledgeDBs.get(user.publicKey, newDB());
  return getParentRepo(knowledgeDBs, views, user.publicKey, viewContext);
}

export function useIsAddToNode(): boolean {
  const [, parentView] = useParentRepo();
  const { user, knowledgeDBs } = useData();
  const lastIndex = useRelationIndex();
  if (!parentView || lastIndex === undefined) {
    return false;
  }
  const parentRelations = getRelations(
    knowledgeDBs,
    parentView.relations,
    user.publicKey
  );
  // If I don't have any relations yet
  if (!parentRelations && lastIndex === 0) {
    return true;
  }
  if (!parentRelations) {
    return false;
  }
  if (lastIndex === parentRelations.items.size) {
    return true;
  }
  return false;
}

export function useViewKey(): string {
  return viewPathToString(useViewPath());
}

export function getParentKey(viewKey: string): string {
  return viewKey.split(":").slice(0, -1).join(":");
}

export function getParentView(viewContext: ViewPath): ViewPath | undefined {
  if (viewContext.indexStack.size === 0) {
    return undefined;
  }
  return {
    root: viewContext.root,
    indexStack: viewContext.indexStack.pop(),
  };
}

export function popPrefix(viewKey: string): [string, string] {
  const prefix = viewKey.split(":")[0];
  // eslint-disable-next-line functional/immutable-data
  const key = viewKey.split(":").splice(1).join(":");
  return [prefix, key];
}

export function parseViewPath(key: string): ViewPath {
  return {
    root: key.split(":")[0],
    indexStack: List<number>(
      key
        .split(":")
        .slice(1)
        .map((str) => parseInt(str, 10))
    ),
  };
}

export function updateView(views: Views, path: ViewPath, view: View): Views {
  return views.set(viewPathToString(path), view);
}

function deleteView(views: Views, path: ViewPath): Views {
  const key = viewPathToString(path);
  return views.filterNot((v, k) => k.startsWith(key));
}

export function deleteChildViews(views: Views, path: ViewPath): Views {
  const key = viewPathToString(path);
  return views.filter((v, k) => !k.startsWith(key) || k === key);
}

function newRelations(head: ID, type: RelationType): Relations {
  return {
    head,
    items: List<ID>(),
    id: v4(),
    type,
  };
}

function createUpdatableRelations(
  knowledgeDBs: KnowledgeDBs,
  viewContext: ViewPath,
  myself: PublicKey,
  relationsID: ID,
  head: ID,
  type: RelationType
): Relations {
  const [remote, id] = splitID(relationsID);
  if (remote && isRemote(remote, myself)) {
    // copy remote relations
    const remoteRelations = knowledgeDBs.get(remote, newDB()).relations.get(id);
    if (!remoteRelations) {
      // This should not happen
      return newRelations(head, type);
    }
    // Make a copy
    return {
      ...remoteRelations,
      id: v4(),
    };
  }
  return knowledgeDBs
    .get(myself, newDB())
    .relations.get(id, newRelations(head, type));
}

export function updateRelations(
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
  if (!node || !nodeView || !nodeView.relations) {
    throw new Error("Nothing to update");
  }
  const relations = createUpdatableRelations(
    plan.knowledgeDBs,
    viewContext,
    plan.user.publicKey,
    nodeView.relations,
    node.id,
    "" as RelationType // TODO: relation type?
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
  return planUpdateRelations(planWithUpdatedView, updatedRelations);
}

/*
function createUpdatableRepo(
  repos: Repos,
  views: Views,
  viewContext: ViewPath
):
  | [Repos, Views, Repo, BranchPath, View]
  | [Repos, Views, undefined, undefined, undefined] {
  const root = repos.get(viewContext.root);
  if (!root) {
    return [repos, views, undefined, undefined, undefined];
  }
  const [repo, view] = getNodeFromView(repos, views, viewContext);
  if (!repo) {
    return [repos, views, undefined, undefined, undefined];
  }
  const [editableRepo, editableBranch] = ensureLocalBranch(repo, view.branch);
  // If the parent Repo is a WORKSPACE let update the view
  const [parentRepo, parentView] = getParentRepo(repos, views, viewContext);
  if (
    parentRepo &&
    getNode(parentRepo, parentView.branch).nodeType === "WORKSPACE"
  ) {
    const updatedView = {
      ...view,
      branch: editableBranch,
    };
    return [
      repos.set(editableRepo.id, editableRepo),
      isBranchEqual(view.branch, updatedView.branch)
        ? views
        : views.set(viewPathToString(viewContext), updatedView),
      editableRepo,
      editableBranch,
      updatedView,
    ];
  }
  return [
    repos.set(editableRepo.id, editableRepo),
    views,
    editableRepo,
    editableBranch,
    view,
  ];
}

export function updateNode(
  r: Repos,
  v: Views,
  viewContext: ViewPath,
  modify: (node: KnowNode, ctx: { view: View }) => KnowNode
): { repos: Repos; views: Views } {
  const [repos, views, repo, branch, view] = createUpdatableRepo(
    r,
    v,
    viewContext
  );
  if (!repo) {
    return { repos, views };
  }
  const node = getNode(repo, branch);
  const updatedRepo = addToBranch(repo, modify(node, { view }), branch[1]);
  return {
    repos: repos.set(updatedRepo.id, updatedRepo),
    views,
  };
}
   */

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

export function findViewsForRepo(
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

function deleteChildren(
  v: Views,
  parentViewPath: string,
  indices: Set<number>
): Views {
  // Delete Child Views
  const views = indices.reduce((acc, i) => {
    const path = `${parentViewPath}:${i}`;
    return deleteView(acc, parseViewPath(path));
  }, v);

  return updateRelationViews(views, parentViewPath, (relations) => {
    return indices
      .sortBy((index) => -index)
      .reduce((r, deleteIndex) => r.delete(deleteIndex), relations);
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

export function updateViewPathsAfterDeletion(
  knowledgeDBs: KnowledgeDBs,
  views: Views,
  myself: PublicKey,
  repoPath: ViewPath,
  deletes: Set<number>
): Views {
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
    return deleteChildren(accViews, parentViewPath, deletes);
    // move views up
  }, views);
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
