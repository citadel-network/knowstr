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
} from "../ViewContext";
import {
  switchOffMultiselect,
  useDeselectAllInView,
  useGetSelectedInView,
  useSelectedIndices,
  useTemporaryView,
} from "./TemporaryViewContext";
import { planUpdateViews, usePlanner } from "../planner";
import { newDB } from "../knowledge";
import { useData } from "../DataContext";
import { useApis } from "../Apis";

export function DisconnectBtn(): JSX.Element | null {
  const { knowledgeDBs, user } = useData();
  const { finalizeEvent } = useApis();
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
    const relations = getRelationsFromView(
      knowledgeDBs,
      user.publicKey,
      viewContext
    );
    if (!relations) {
      return;
    }
    const disconnectPlan = upsertRelations(
      createPlan(),
      viewContext,
      (rel) => deleteRelations(rel, selectedIndices),
      finalizeEvent
    );
    const finalPlan = selected.reduce((plan, path) => {
      const { views } = plan.knowledgeDBs.get(plan.user.publicKey, newDB());
      const { nodeID, nodeIndex } = getLast(parseViewPath(path));
      return planUpdateViews(
        plan,
        updateViewPathsAfterDisconnect(views, nodeID, relations.id, nodeIndex),
        finalizeEvent
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
