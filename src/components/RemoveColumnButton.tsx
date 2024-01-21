import { Set } from "immutable";
import React from "react";
import { useApis } from "../Apis";
import { deleteRelations } from "../connections";
import {
  getParentView,
  useRelationIndex,
  useViewPath,
  useViewKey,
  updateViewPathsAfterDeletion,
  upsertRelations,
} from "../ViewContext";
import { switchOffMultiselect, useTemporaryView } from "./TemporaryViewContext";
import { planUpdateViews, usePlanner } from "../planner";
import { newDB } from "../knowledge";

export function RemoveColumnButton(): JSX.Element | null {
  const { deleteLocalStorage } = useApis().fileStore;
  const { createPlan, executePlan } = usePlanner();
  const index = useRelationIndex();
  const { multiselectBtns, selection, setState } = useTemporaryView();
  const viewKey = useViewKey();
  const viewPath = useViewPath();
  const parentView = getParentView(viewPath);
  if (index === undefined || !parentView) {
    return null;
  }

  const onClick = (): void => {
    deleteLocalStorage(viewKey);
    const updateRelationsPlan = upsertRelations(
      createPlan(),
      parentView,
      (relations) => deleteRelations(relations, Set<number>([index]))
    );

    const updatedViews = updateViewPathsAfterDeletion(
      updateRelationsPlan.knowledgeDBs,
      updateRelationsPlan.knowledgeDBs.get(
        updateRelationsPlan.user.publicKey,
        newDB()
      ).views,
      updateRelationsPlan.user.publicKey,
      parentView,
      Set<number>([index])
    );
    const plan = planUpdateViews(updateRelationsPlan, updatedViews);
    executePlan(plan);
    setState(switchOffMultiselect(multiselectBtns, selection, viewKey));
  };

  return (
    <button
      type="button"
      aria-label="close"
      className="outer-node-extras-close-btn"
      onClick={onClick}
    >
      <span>×</span>
    </button>
  );
}
