import React from "react";
import { List } from "immutable";
import { useLocation, useParams } from "react-router-dom";
import { getBranch } from "../knowledge";
import { OverwriteKnowledgeDataContext } from "../KnowledgeDataContext";
import {
  getDefaultView,
  updateView,
  getViewExactMatch,
  ViewContextProvider,
  useRepo,
} from "../ViewContext";
import { TemporaryViewProvider } from "./TemporaryViewContext";

export function useBranchPathFromURLParams(): BranchPath | undefined {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const origin = params.get("origin");
  const branchName = params.get("branch");
  if (origin && branchName) {
    return [origin as PublicKey, branchName];
  }
  if (!origin && branchName) {
    return [undefined, branchName];
  }
  return undefined;
}

export function FullScreenViewWrapper({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element | null {
  const { openNodeID: id } = useParams<{
    openNodeID: string;
  }>() as { openNodeID: string };
  const [workspace] = useRepo();
  const workspaceID = workspace ? workspace.id : undefined;
  const root = id || workspaceID;
  if (!root) {
    return null;
  }
  const branchPathFromURL = useBranchPathFromURLParams();

  // If there is a branch passed via URL parameter, we need to overwrite
  // the selected branch in the view otherwise we display a wrong branch
  const overwrite = (knowledgeData: KnowledgeData): KnowledgeData => {
    const repo = knowledgeData.repos.get(id);
    if (!repo) {
      return knowledgeData;
    }
    if (branchPathFromURL && getBranch(repo, branchPathFromURL)) {
      const viewPath = { root: id, indexStack: List<number>() };
      const view =
        getViewExactMatch(knowledgeData.views, viewPath) ||
        getDefaultView(repo);
      return {
        ...knowledgeData,
        views: updateView(knowledgeData.views, viewPath, {
          ...view,
          branch: branchPathFromURL,
        }),
      };
    }
    return knowledgeData;
  };

  return (
    <OverwriteKnowledgeDataContext updateData={overwrite}>
      <TemporaryViewProvider>
        <ViewContextProvider root={root}>{children}</ViewContextProvider>
      </TemporaryViewProvider>
    </OverwriteKnowledgeDataContext>
  );
}
