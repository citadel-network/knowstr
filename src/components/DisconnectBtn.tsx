import React from "react";
import { deleteRelations } from "../connections";
import { useKnowledgeData, useUpdateKnowledge } from "../KnowledgeDataContext";
import {
  updateNode,
  useViewPath,
  useViewKey,
  updateViewPathsAfterDeletion,
} from "../ViewContext";
import {
  useDeselectAllInView,
  useSelectedIndices,
} from "./TemporaryViewContext";

export function DisconnectBtn(): JSX.Element | null {
  const { repos, views } = useKnowledgeData();
  const upsertRepos = useUpdateKnowledge();
  const viewContext = useViewPath();
  const selectedIndices = useSelectedIndices();
  const deselectAllInView = useDeselectAllInView();
  const viewKey = useViewKey();
  if (selectedIndices.size === 0) {
    return null;
  }
  const onDisconnect = (): void => {
    const d = updateNode(repos, views, viewContext, (node, { view }) =>
      deleteRelations(node, selectedIndices, view.relationType)
    );
    upsertRepos({
      repos: d.repos,
      views: updateViewPathsAfterDeletion(
        d.repos,
        d.views,
        viewContext,
        selectedIndices
      ),
    });
    deselectAllInView(viewKey);
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
