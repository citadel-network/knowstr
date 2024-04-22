import React from "react";
import { List, OrderedSet } from "immutable";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { getSelectedInView } from "./components/TemporaryViewContext";
import { bulkAddRelations, getRelations, moveRelations } from "./connections";
import { newDB } from "./knowledge";
import {
  parseViewPath,
  getNodeFromView,
  upsertRelations,
  getParentNode,
  getParentKey,
  ViewPath,
  getParentView,
  bulkUpdateViewPathsAfterAddRelation,
  updateViewPathsAfterMoveRelations,
  getRelationIndex,
} from "./ViewContext";
import { getNodesInTree } from "./components/Node";
import { Plan, planUpdateViews } from "./planner";

function getDropDestinationEndOfRoot(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  views: Views,
  root: ViewPath
): [ViewPath, number] {
  // TODO: Replace everything here with getRelationsFromView
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
  // new index is the current index of the sibling
  const index = getRelationIndex(knowledgeDBs, myself, dropBefore);
  return [parentView, index || 0];
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
  to: ViewPath,
  indexTo: number | undefined
): Plan {
  const { knowledgeDBs } = plan;
  const myself = plan.user.publicKey;
  const myDB = knowledgeDBs.get(myself, newDB());
  const { views } = myDB;
  // remove the prefix
  const rootView = to;
  const [knowNode] = getNodeFromView(knowledgeDBs, views, myself, rootView);
  if (!knowNode) {
    return plan;
  }

  const sourceViewPath = parseViewPath(source);
  const sourceView = getNodeFromView(
    knowledgeDBs,
    views,
    myself,
    sourceViewPath
  )[1];
  if (!sourceView) {
    return plan;
  }
  const selectedSources = getSelectedInView(selection, getParentKey(source));
  const sources = selection.contains(source) ? selectedSources : List([source]);

  const sourceNodes = List(
    sources.map((s) => {
      const path = parseViewPath(s);
      const [node] = getNodeFromView(knowledgeDBs, views, myself, path);
      return node ? node.id : undefined;
    })
  ).filter((n) => n !== undefined) as List<LongID>;
  const sourceIndices = List(
    sources.map((n) => getRelationIndex(knowledgeDBs, myself, parseViewPath(n)))
  ).filter((n) => n !== undefined) as List<number>;

  const [fromRepo, fromView] = getParentNode(
    knowledgeDBs,
    views,
    myself,
    sourceViewPath
  );

  const [toView, dropIndex] =
    indexTo === undefined
      ? [rootView, undefined]
      : getDropDestinationFromTreeView(
          knowledgeDBs,
          myself,
          views,
          rootView,
          indexTo
        );

  const [toRepo, toV] = getNodeFromView(knowledgeDBs, views, myself, toView);
  if (!toRepo) {
    return plan;
  }

  // TODO: this can be optimized
  const move =
    dropIndex !== undefined &&
    fromRepo !== undefined &&
    toRepo.id === fromRepo.id &&
    fromView.relations === toV.relations;

  const updatedRelationsPlan = upsertRelations(
    plan,
    toView,
    (relations: Relations) => {
      if (move) {
        return moveRelations(relations, sourceIndices.toArray(), dropIndex);
      }
      return bulkAddRelations(relations, sourceNodes.toArray(), dropIndex);
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
        sourceNodes.size,
        dropIndex
      );
  return planUpdateViews(updatedRelationsPlan, updatedViews);
}

export function DND({ children }: { children: React.ReactNode }): JSX.Element {
  return <DndProvider backend={HTML5Backend}>{children}</DndProvider>;
}
