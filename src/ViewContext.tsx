import React from "react";
import { List, Set, Map } from "immutable";
import { useKnowledgeData } from "./KnowledgeDataContext";
import {
  addToBranch,
  ensureLocalBranch,
  getDefaultBranch,
  getNode,
  isBranchEqual,
} from "./knowledge";
import { getRelations, getSubjects } from "./connections";

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

function defaultViewOptions(nodeType: NodeType): [RelationType, boolean] {
  if (["TITLE", "URL", "VIEW"].includes(nodeType)) {
    return ["CONTAINS", false];
  }
  return ["RELEVANCE", false];
}

export function getDefaultView(repo: Repo): View {
  const defaultBranch = getDefaultBranch(repo);
  if (!defaultBranch) {
    throw new Error(`Repo ${repo.id} does not have any branches`);
  }
  const node = getNode(repo, defaultBranch);
  const [relationType, displaySubjects] = defaultViewOptions(node.nodeType);
  return {
    relationType,
    displaySubjects,
    width: 1,
    branch: defaultBranch,
    expanded: false,
  };
}

function getRepo(
  repos: Repos,
  views: Views,
  root: Repo,
  indices: List<number>,
  startPath: ViewPath
): [Repo, View] {
  const view = getViewExactMatch(views, startPath) || getDefaultView(root);
  const index = indices.get(0);
  if (index === undefined) {
    return [root, view];
  }
  const node = getNode(root, view.branch);
  const relations = getRelations(node, view.relationType);
  if (index === relations.size) {
    throw new Error(
      `View path index reserved for AddNodeButton. No repo found ${viewPathToString(
        {
          root: startPath.root,
          indexStack: indices,
        }
      )}`
    );
  }
  if (index > relations.size) {
    const subjectEntries = getSubjects(repos, root.id).toArray();
    const subjectEntry = subjectEntries[index - relations.size - 1];
    if (!subjectEntry) {
      throw new Error(
        `No repo for view path found ${viewPathToString({
          root: startPath.root,
          indexStack: indices,
        })}`
      );
    }
    const subject = subjectEntry[1];
    if (!subject) {
      throw new Error("Subject does not exist");
    }
    const subjectBranch = getDefaultBranch(subject);
    if (!subjectBranch) {
      throw new Error("Subject does not have branches");
    }
    return getRepo(repos, views, subject, indices.remove(0), {
      root: startPath.root,
      indexStack: startPath.indexStack.push(index),
    });
  }
  const relationToObject = relations.get(index);
  if (!relationToObject) {
    throw new Error("Wrong path");
  }
  const obj = repos.get(relationToObject.id);
  if (!obj) {
    throw new Error(`Object ${relationToObject.id} does not exist`);
  }
  return getRepo(repos, views, obj, indices.remove(0), {
    root: startPath.root,
    indexStack: startPath.indexStack.push(index),
  });
}

export function useRelationIndex(): number | undefined {
  const viewContext = useViewPath();
  return viewContext.indexStack.last();
}

export function getRepoFromView(
  repos: Repos,
  views: Views,
  viewContext: ViewPath
): [Repo, View] | [undefined, undefined] {
  const root = repos.get(viewContext.root);
  if (!root) {
    return [undefined, undefined];
  }
  const rootViewPath = { root: root.id, indexStack: List<number>() };
  try {
    return getRepo(repos, views, root, viewContext.indexStack, rootViewPath);
  } catch {
    return [undefined, undefined];
  }
}

export function useRepo(): [Repo, View] | [undefined, undefined] {
  const viewContext = useViewPath();
  const { repos, views } = useKnowledgeData();
  return getRepoFromView(repos, views, viewContext);
}

export function getParentRepo(
  repos: Repos,
  views: Views,
  viewContext: ViewPath
): [Repo, View] | [undefined, undefined] {
  const lastIndex = viewContext.indexStack.last();
  const root = repos.get(viewContext.root);
  if (lastIndex === undefined || !root) {
    return [undefined, undefined];
  }
  return getRepo(repos, views, root, viewContext.indexStack.pop(), {
    root: root.id,
    indexStack: List<number>(),
  });
}

export function useParentRepo(): [Repo, View] | [undefined, undefined] {
  const viewContext = useViewPath();
  const { repos, views } = useKnowledgeData();
  return getParentRepo(repos, views, viewContext);
}

export function useIsAddToNode(): boolean {
  const [parentRepo, parentView] = useParentRepo();
  const lastIndex = useRelationIndex();
  if (!parentRepo || lastIndex === undefined) {
    return false;
  }
  const parentNode = getNode(parentRepo, parentView.branch);
  const parentRelations = getRelations(parentNode, parentView.relationType);
  if (lastIndex === parentRelations.size) {
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
  const [repo, view] = getRepoFromView(repos, views, viewContext);
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
  repos: Repos,
  views: Views,
  id: string,
  relationType: RelationType,
  branch: BranchPath
): Set<string> {
  // include partial, non existing views
  const paths = views.reduce((acc, _, path) => {
    return acc.merge(getAllSubpaths(path));
  }, Set<string>());
  return paths.filter((path) => {
    try {
      const [repo, view] = getRepoFromView(repos, views, parseViewPath(path));
      return (
        repo &&
        repo.id === id &&
        isBranchEqual(branch, view.branch) &&
        view.relationType === relationType
      );
    } catch {
      // Some view paths lead to nowhere
      return false;
    }
  });
}

function updateRelations(
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
  return updateRelations(views, parentViewPath, (relations) => {
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

  return updateRelations(views, parentViewPath, (relations) => {
    return indices
      .sortBy((index) => -index)
      .reduce((r, deleteIndex) => r.delete(deleteIndex), relations);
  });
}

export function updateViewPathsAfterMoveRelations(
  repos: Repos,
  views: Views,
  repoPath: ViewPath,
  indices: Array<number>,
  startPosition?: number
): Views {
  // nothing to do
  if (startPosition === undefined) {
    return views;
  }
  const [repo, view] = getRepoFromView(repos, views, repoPath);
  if (!repo) {
    return views;
  }
  const viewKeys = findViewsForRepo(
    repos,
    views,
    repo.id,
    view.relationType,
    view.branch
  );
  const sortedViewKeys = viewKeys.sort(
    (a, b) => b.split(":").length - a.split(":").length
  );
  return sortedViewKeys.reduce((accViews, parentViewPath) => {
    return moveChildViews(accViews, parentViewPath, indices, startPosition);
  }, views);
}

export function updateViewPathsAfterAddRelation(
  repos: Repos,
  views: Views,
  repoPath: ViewPath,
  ord?: number
): Views {
  // nothing to do
  if (ord === undefined) {
    return views;
  }
  const [repo, view] = getRepoFromView(repos, views, repoPath);
  if (!repo) {
    return views;
  }
  const viewKeys = findViewsForRepo(
    repos,
    views,
    repo.id,
    view.relationType,
    view.branch
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
  repos: Repos,
  views: Views,
  repoPath: ViewPath,
  deletes: Set<number>
): Views {
  const [repo, view] = getRepoFromView(repos, views, repoPath);
  if (!repo) {
    return views;
  }
  const viewKeys = findViewsForRepo(
    repos,
    views,
    repo.id,
    view.relationType,
    view.branch
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
  repos: Repos,
  views: Views,
  repoPath: ViewPath,
  nAdds: number,
  startPos?: number
): Views {
  return List<undefined>([])
    .set(nAdds - 1, undefined)
    .reduce((rdx, i, currentIndex) => {
      return updateViewPathsAfterAddRelation(
        repos,
        views,
        repoPath,
        startPos !== undefined ? startPos + currentIndex : undefined
      );
    }, views);
}
