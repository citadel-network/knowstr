import { Set } from "immutable";
import React from "react";
import { useApis } from "../Apis";
import { deleteRelationsFromNode } from "../connections";
import { useKnowledgeData, useUpdateKnowledge } from "../KnowledgeDataContext";
import {
  getParentView,
  updateNode,
  useRelationIndex,
  useViewPath,
  useViewKey,
  updateViewPathsAfterDeletion,
} from "../ViewContext";
import { switchOffMultiselect, useTemporaryView } from "./TemporaryViewContext";

export function RemoveColumnButton(): JSX.Element | null {
  const { deleteLocalStorage } = useApis().fileStore;
  const index = useRelationIndex();
  const { multiselectBtns, selection, setState } = useTemporaryView();
  const viewKey = useViewKey();
  const viewPath = useViewPath();
  const upsertRepos = useUpdateKnowledge();
  const { repos, views } = useKnowledgeData();
  const parentView = getParentView(viewPath);
  if (index === undefined || !parentView) {
    return null;
  }

  const onClick = (): void => {
    deleteLocalStorage(viewKey);
    const updatedData = updateNode(
      repos,
      views,
      parentView,
      (workspace, { view }) =>
        deleteRelationsFromNode(
          workspace,
          Set<number>([index]),
          view.relationType
        )
    );
    const updatedViews = updateViewPathsAfterDeletion(
      updatedData.repos,
      updatedData.views,
      parentView,
      Set<number>([index])
    );
    upsertRepos({
      ...updatedData,
      views: updatedViews,
    });
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
