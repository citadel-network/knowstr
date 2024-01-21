import React from "react";
import { deleteRelations } from "../connections";
import {
  useViewPath,
  useViewKey,
  updateViewPathsAfterDeletion,
  upsertRelations,
} from "../ViewContext";
import {
  switchOffMultiselect,
  useDeselectAllInView,
  useSelectedIndices,
  useTemporaryView,
} from "./TemporaryViewContext";
import { planUpdateViews, usePlanner } from "../planner";
import { newDB } from "../knowledge";

export function DisconnectBtn(): JSX.Element | null {
  const { createPlan, executePlan } = usePlanner();
  const { multiselectBtns, selection, setState } = useTemporaryView();
  const viewContext = useViewPath();
  const viewKey = useViewKey();
  const selectedIndices = useSelectedIndices();
  const deselectAllInView = useDeselectAllInView();
  if (selectedIndices.size === 0) {
    return null;
  }
  const onDisconnect = (): void => {
    const disconnectPlan = upsertRelations(
      createPlan(),
      viewContext,
      (relations) => deleteRelations(relations, selectedIndices)
    );
    const { views } = disconnectPlan.knowledgeDBs.get(
      disconnectPlan.user.publicKey,
      newDB()
    );
    executePlan(
      planUpdateViews(
        disconnectPlan,
        updateViewPathsAfterDeletion(
          disconnectPlan.knowledgeDBs,
          views,
          disconnectPlan.user.publicKey,
          viewContext,
          selectedIndices
        )
      )
    );
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
