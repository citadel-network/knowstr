import React, { createContext, useState } from "react";
import { List, OrderedSet, Set } from "immutable";
import {
  DragDropContext,
  DragUpdate,
  DropResult,
  ResponderProvided,
} from "react-beautiful-dnd";
import {
  deselectAllChildren,
  getSelectedIndices,
  useTemporaryView,
} from "./components/TemporaryViewContext";
import { bulkAddRelations, getRelations, moveRelations } from "./connections";
import { getNode, isBranchEqual } from "./knowledge";
import { useKnowledgeData, useUpdateKnowledge } from "./KnowledgeDataContext";
import {
  parseViewPath,
  getRepoFromView,
  updateNode,
  getParentRepo,
  popPrefix,
  getParentKey,
  ViewPath,
  getParentView,
  updateView,
  bulkUpdateViewPathsAfterAddRelation,
  updateViewPathsAfterMoveRelations,
} from "./ViewContext";
import { getNodesInTree } from "./components/Node";

function getDropDestinationEndOfRoot(
  repos: Repos,
  views: Views,
  root: ViewPath
): [ViewPath, number] {
  const [rootRepo, rootView] = getRepoFromView(repos, views, root);
  if (!rootRepo) {
    // eslint-disable-next-line no-console
    console.error(
      "root repo does not exist",
      root,
      repos.toJSON(),
      views.toJSON()
    );
    throw new Error("Root repo doesn't exist");
  }
  const rootNode = getNode(rootRepo, rootView.branch);
  const relations = getRelations(rootNode, rootView.relationType);
  return [root, relations.size];
}

export function getDropDestinationFromTreeView(
  repos: Repos,
  views: Views,
  root: ViewPath,
  destinationIndex: number
): [ViewPath, number] {
  const nodes = getNodesInTree(repos, views, root, List<ViewPath>());
  const dropBefore = nodes.get(destinationIndex);
  if (!dropBefore) {
    return getDropDestinationEndOfRoot(repos, views, root);
  }
  const parentView = getParentView(dropBefore);
  if (!parentView) {
    return getDropDestinationEndOfRoot(repos, views, root);
  }
  // index is last path element of the sibling
  return [parentView, dropBefore.indexStack.last(0)];
}

// Workspace
// drag 18fbe5b5-6516-4cdb-adde-860bf47c9eb0:0:0 to 18fbe5b5-6516-4cdb-adde-860bf47c9eb0 [new] [0]
//
// Inner Node
// drag 18fbe5b5-6516-4cdb-adde-860bf47c9eb0:0:0 to 18fbe5b5-6516-4cdb-adde-860bf47c9eb0:1 [inner] [0]
//
// drop on Outer Node
// drag 18fbe5b5-6516-4cdb-adde-860bf47c9eb0:0 to 18fbe5b5-6516-4cdb-adde-860bf47c9eb0:1 [bottom] [0]

export function dnd(
  repos: Repos,
  views: Views,
  selection: OrderedSet<string>,
  source: string,
  to: string,
  toIndex: number
): { repos: Repos; views: Views } {
  // remove the prefix
  const [prefix, toKey] = popPrefix(to);
  const rootView = parseViewPath(toKey);
  const [rootRepo] = getRepoFromView(repos, views, rootView);
  if (!rootRepo) {
    return { repos, views };
  }

  const sourceViewPath = parseViewPath(source);
  const sourceIndex = sourceViewPath.indexStack.last() || 0;
  const sourceView = getRepoFromView(repos, views, sourceViewPath)[1];
  if (!sourceView) {
    return { repos, views };
  }
  const sourceIndices = selection.contains(source)
    ? // eslint-disable-next-line functional/immutable-data
      getSelectedIndices(selection, getParentKey(source))
    : Set<number>([sourceIndex]); // get source multiselect

  const isTreeView = prefix === "tree";
  const indexTo = isTreeView ? toIndex : undefined;

  const sourceRepos = sourceIndices
    .toList()
    .map((index) => {
      const [r] = getRepoFromView(repos, views, {
        root: sourceViewPath.root,
        indexStack: sourceViewPath.indexStack.pop().push(index),
      });
      return r ? r.id : undefined;
    })
    .filter((id) => id) as List<string>;

  const [fromRepo, fromView] = getParentRepo(repos, views, sourceViewPath);

  // While we are dragging the source will always be collapsed, therefore
  // we need to calculate the new destination with the view collapsed
  const viewsWithCollapsedSource = updateView(views, sourceViewPath, {
    ...sourceView,
    expanded: false,
  });

  const [toView, dropIndex] =
    indexTo === undefined
      ? [rootView, undefined]
      : getDropDestinationFromTreeView(
          repos,
          viewsWithCollapsedSource,
          rootView,
          indexTo
        );

  const [toRepo, toV] = getRepoFromView(repos, views, toView);
  if (!toRepo) {
    return { repos, views };
  }

  const move =
    dropIndex !== undefined &&
    fromRepo !== undefined &&
    toRepo.id === fromRepo.id &&
    isBranchEqual(fromView.branch, toV.branch) &&
    fromView.relationType === toV.relationType;

  const updatedKnowledge = updateNode(
    repos,
    views,
    toView,
    (node, { view }) => {
      if (move) {
        // move
        return moveRelations(
          node,
          sourceIndices.toArray(),
          dropIndex,
          view.relationType
        );
      }
      // add
      return bulkAddRelations(
        node,
        sourceRepos.toArray(),
        view.relationType,
        dropIndex
      );
    }
  );

  const updatedViews = move
    ? updateViewPathsAfterMoveRelations(
        updatedKnowledge.repos,
        updatedKnowledge.views,
        toView,
        sourceIndices.toArray(),
        dropIndex
      )
    : bulkUpdateViewPathsAfterAddRelation(
        updatedKnowledge.repos,
        updatedKnowledge.views,
        toView,
        sourceRepos.size,
        dropIndex
      );
  return {
    ...updatedKnowledge,
    views: updatedViews,
  };
}

type DragUpdateState = {
  initial: DragUpdate | undefined;
  provided: ResponderProvided | undefined;
};

export const DragUpdateStateContext = createContext<
  DragUpdateState | undefined
>(undefined);

export function DND({ children }: { children: React.ReactNode }): JSX.Element {
  const { repos, views } = useKnowledgeData();
  const upsertRepos = useUpdateKnowledge();
  const { setState, selection, multiselectBtns } = useTemporaryView();
  const [dragUpdateState, setDragUpdateState] = useState<DragUpdateState>({
    initial: undefined,
    provided: undefined,
  });

  const onDragEnd = (result: DropResult): void => {
    if (result.destination) {
      upsertRepos(
        dnd(
          repos,
          views,
          selection,
          result.draggableId,
          result.destination.droppableId,
          result.destination.index
        )
      );
      const parentKey = getParentKey(result.draggableId);
      setState({
        selection: deselectAllChildren(selection, parentKey),
        multiselectBtns: multiselectBtns.remove(parentKey),
      });
    }
  };

  const onDragUpdate = (
    initial: DragUpdate,
    provided: ResponderProvided
  ): void => {
    setDragUpdateState({ initial, provided });
  };

  return (
    <DragUpdateStateContext.Provider value={dragUpdateState}>
      <DragDropContext onDragEnd={onDragEnd} onDragUpdate={onDragUpdate}>
        {children}
      </DragDropContext>
    </DragUpdateStateContext.Provider>
  );
}
