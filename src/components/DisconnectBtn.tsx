import React from "react";
import { deleteRelations } from "../connections";
import {
  useViewPath,
  useViewKey,
  upsertRelations,
  getRelationsFromView,
  getLast,
  updateViewPathsAfterDisconnect,
  parseViewPath,
  popPath,
  calculateIndexFromNodeIndex,
} from "../ViewContext";
import {
  switchOffMultiselect,
  useDeselectAllInView,
  useGetSelectedInView,
  useSelectedIndices,
  useTemporaryView,
} from "./TemporaryViewContext";
import { planUpdateViews, usePlanner } from "../planner";
import { useData } from "../DataContext";

export function DisconnectBtn(): JSX.Element | null {
  const data = useData();
  const { createPlan, executePlan } = usePlanner();
  const { multiselectBtns, selection, setState } = useTemporaryView();
  const viewContext = useViewPath();
  const viewKey = useViewKey();
  const selectedIndices = useSelectedIndices();
  const selected = useGetSelectedInView()(viewKey);
  const deselectAllInView = useDeselectAllInView();
  if (selectedIndices.size === 0) {
    return null;
  }
  const onDisconnect = (): void => {
    const relations = getRelationsFromView(data, viewContext);
    if (!relations) {
      return;
    }
    const disconnectPlan = upsertRelations(createPlan(), viewContext, (rel) =>
      deleteRelations(rel, selectedIndices)
    );
    const finalPlan = selected.reduce((plan, path) => {
      const { nodeID, nodeIndex } = getLast(parseViewPath(path));
      return planUpdateViews(
        plan,
        updateViewPathsAfterDisconnect(
          plan.views,
          nodeID,
          relations.id,
          nodeIndex
        )
      );
    }, disconnectPlan);
    executePlan(finalPlan);
    deselectAllInView(viewKey);
    setState(switchOffMultiselect(multiselectBtns, selection, viewKey));
  };

  return (
    <button
      type="button"
      className="btn btn-borderless p-0"
      onClick={onDisconnect}
      aria-label={`disconnect ${selectedIndices.size} selected nodes`}
    >
      <span style={{ fontSize: "1.4rem" }}>×</span>
    </button>
  );
}

export function DisconnectNodeBtn(): JSX.Element | null {
  const data = useData();
  const { createPlan, executePlan } = usePlanner();
  const viewPath = useViewPath();
  const { nodeID, nodeIndex } = getLast(viewPath);
  const parentPath = popPath(viewPath);
  if (!parentPath) {
    return null;
  }
  const { nodeID: parentNodeID } = getLast(parentPath);
  const relations = getRelationsFromView(data, parentPath);
  if (!relations) {
    return null;
  }
  const index = calculateIndexFromNodeIndex(relations, nodeID, nodeIndex);
  if (index === undefined) {
    return null;
  }

  const onDisconnect = (): void => {
    const disconnectPlan = upsertRelations(
      createPlan(),
      parentPath,
      (rel): Relations => {
        return {
          ...rel,
          items: rel.items.delete(index),
        };
      }
    );
    const finalPlan = planUpdateViews(
      disconnectPlan,
      updateViewPathsAfterDisconnect(
        disconnectPlan.views,
        parentNodeID,
        relations.id,
        nodeIndex
      )
    );
    executePlan(finalPlan);
  };

  return (
    <button
      type="button"
      className="btn btn-borderless p-0"
      onClick={onDisconnect}
      aria-label={`disconnect node ${nodeIndex}`}
    >
      <span style={{ fontSize: "1.4rem" }}>×</span>
    </button>
  );
}
