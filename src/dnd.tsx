import React, { createContext, useEffect, useState } from "react";
import { List, OrderedSet, Set } from "immutable";
import {
  DragDropContext,
  DragUpdate,
  DropResult,
  ResponderProvided,
} from "@hello-pangea/dnd";
import {
  deselectAllChildren,
  getSelectedIndices,
  useTemporaryView,
} from "./components/TemporaryViewContext";
import {
  bulkAddRelations,
  deleteRelations,
  getRelations,
  moveRelations,
} from "./connections";
import { newDB } from "./knowledge";
import {
  parseViewPath,
  getNodeFromView,
  upsertRelations,
  getParentNode,
  popPrefix,
  getParentKey,
  ViewPath,
  getParentView,
  updateView,
  bulkUpdateViewPathsAfterAddRelation,
  updateViewPathsAfterMoveRelations,
  updateViewPathsAfterDeletion,
} from "./ViewContext";
import { getNodesInTree } from "./components/Node";
import { Plan, planUpdateViews, usePlanner } from "./planner";

function getDropDestinationEndOfRoot(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  views: Views,
  root: ViewPath
): [ViewPath, number] {
  const [rootNode, rootView] = getNodeFromView(
    knowledgeDBs,
    views,
    myself,
    root
  );
  if (!rootView) {
    // eslint-disable-next-line no-console
    console.error(
      "root node does not exist",
      rootView,
      root,
      knowledgeDBs.toJSON(),
      views.toJSON()
    );
    throw new Error("Root repo doesn't exist");
  }
  const relations = getRelations(
    knowledgeDBs,
    rootView.relations,
    myself,
    rootNode.id
  );
  return [root, relations?.items.size || 0];
}

export function getDropDestinationFromTreeView(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  views: Views,
  root: ViewPath,
  destinationIndex: number
): [ViewPath, number] {
  const nodes = getNodesInTree(knowledgeDBs, myself, root, List<ViewPath>());
  const dropBefore = nodes.get(destinationIndex);
  if (!dropBefore) {
    return getDropDestinationEndOfRoot(knowledgeDBs, myself, views, root);
  }
  const parentView = getParentView(dropBefore);
  if (!parentView) {
    return getDropDestinationEndOfRoot(knowledgeDBs, myself, views, root);
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
  plan: Plan,
  selection: OrderedSet<string>,
  source: string,
  to: string,
  toIndex: number,
  isDeleteSourceRelations: boolean
): Plan {
  const { knowledgeDBs } = plan;
  const myself = plan.user.publicKey;
  const myDB = knowledgeDBs.get(myself, newDB());
  const { views } = myDB;
  // remove the prefix
  const [prefix, toKey] = popPrefix(to);
  const rootView = parseViewPath(toKey);
  const [knowNode] = getNodeFromView(knowledgeDBs, views, myself, rootView);
  if (!knowNode) {
    return plan;
  }

  const sourceViewPath = parseViewPath(source);
  const sourceIndex = sourceViewPath.indexStack.last() || 0;
  const sourceView = getNodeFromView(
    knowledgeDBs,
    views,
    myself,
    sourceViewPath
  )[1];
  if (!sourceView) {
    return plan;
  }
  const sourceIndices = selection.contains(source)
    ? // eslint-disable-next-line functional/immutable-data
      getSelectedIndices(selection, getParentKey(source))
    : Set<number>([sourceIndex]); // get source multiselect

  const isTreeView = prefix === "tree";
  const indexTo = isTreeView ? toIndex : undefined;

  const sourceRepos = sourceIndices
    .toList()
    .map((index): LongID | undefined => {
      const [r] = getNodeFromView(knowledgeDBs, views, myself, {
        root: sourceViewPath.root,
        indexStack: sourceViewPath.indexStack.pop().push(index),
      });
      return r ? r.id : undefined;
    })
    .filter((id) => id) as List<LongID>;

  const [fromRepo, fromView] = getParentNode(
    knowledgeDBs,
    views,
    myself,
    sourceViewPath
  );

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
          knowledgeDBs,
          myself,
          viewsWithCollapsedSource,
          rootView,
          indexTo
        );

  const [toRepo, toV] = getNodeFromView(knowledgeDBs, views, myself, toView);
  if (!toRepo) {
    return plan;
  }

  const move =
    dropIndex !== undefined &&
    fromRepo !== undefined &&
    toRepo.id === fromRepo.id &&
    fromView.relations === toV.relations;

  const viewPathForDeleteRelations = getParentView(sourceViewPath);
  const planWithDeletedRelations = viewPathForDeleteRelations
    ? upsertRelations(plan, viewPathForDeleteRelations, (r: Relations) =>
        deleteRelations(r, sourceIndices)
      )
    : plan;
  const { views: viewsWithDeletedRelations } =
    planWithDeletedRelations.knowledgeDBs.get(
      planWithDeletedRelations.user.publicKey,
      newDB()
    );
  const updatedViewsPlan =
    isDeleteSourceRelations && viewPathForDeleteRelations
      ? planUpdateViews(
          planWithDeletedRelations,
          updateViewPathsAfterDeletion(
            planWithDeletedRelations.knowledgeDBs,
            viewsWithDeletedRelations,
            planWithDeletedRelations.user.publicKey,
            viewPathForDeleteRelations,
            sourceIndices
          )
        )
      : plan;

  const updatedRelationsPlan = upsertRelations(
    updatedViewsPlan,
    toView,
    (relations: Relations) => {
      if (move) {
        return moveRelations(relations, sourceIndices.toArray(), dropIndex);
      }
      return bulkAddRelations(relations, sourceRepos.toArray(), dropIndex);
    }
  );
  const updatedViews = move
    ? updateViewPathsAfterMoveRelations(
        updatedRelationsPlan.knowledgeDBs,
        updatedRelationsPlan.user.publicKey,
        toView,
        sourceIndices.toArray(),
        dropIndex
      )
    : bulkUpdateViewPathsAfterAddRelation(
        updatedRelationsPlan.knowledgeDBs,
        updatedRelationsPlan.user.publicKey,
        toView,
        sourceRepos.size,
        dropIndex
      );
  return planUpdateViews(updatedRelationsPlan, updatedViews);
}

type DragUpdateState = {
  initial: DragUpdate | undefined;
  provided: ResponderProvided | undefined;
};

export const DragUpdateStateContext = createContext<
  DragUpdateState | undefined
>(undefined);

export function DND({ children }: { children: React.ReactNode }): JSX.Element {
  const { createPlan, executePlan } = usePlanner();
  const { setState, selection, multiselectBtns } = useTemporaryView();
  const [dragUpdateState, setDragUpdateState] = useState<DragUpdateState>({
    initial: undefined,
    provided: undefined,
  });
  const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Shift") {
        setIsShiftPressed(true);
      }
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      if (event.key === "Shift") {
        setIsShiftPressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const onDragEnd = (result: DropResult): void => {
    if (result.destination) {
      executePlan(
        dnd(
          createPlan(),
          selection,
          result.draggableId,
          result.destination.droppableId,
          result.destination.index,
          isShiftPressed
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
