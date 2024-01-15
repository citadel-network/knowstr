import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useData } from "./DataContext";
import { usePlanner, planSetKnowledgeData } from "./planner";
import {
  KnowledgeDiff,
  applyDiff,
  compareKnowledgeDB,
  mergeKnowledgeData,
  useKnowledgeQuery,
} from "./knowledgeEvents";
import {
  getNode,
  newDB,
  commitAllBranches,
  getDefaultBranch,
  newRepo,
} from "./knowledge";

import { ViewContextProvider } from "./ViewContext";
import { newNode } from "./connections";

type Context = {
  data: KnowledgeData;
  publishKnowledgeData: () => Promise<void>;
  hasUnpublishedData: boolean;
  setKnowledgeData: (data: KnowledgeData) => void;
};

export function shorten(nodeText: string): string {
  return nodeText.substr(0, 30);
}

export const RelationContext = React.createContext<Context | undefined>(
  undefined
);

function getDataContextOrThrow(): Context {
  const context = React.useContext(RelationContext);
  if (context === undefined) {
    throw new Error("RelationContext not provided");
  }
  return context;
}

export function useKnowledgeData(): KnowledgeData {
  return getDataContextOrThrow().data;
}

export function getWorkspaces(repos: Repos): Repos {
  return repos.filter((repo) => getNode(repo).nodeType === "WORKSPACE");
}

function getWorkspaceRepo(knowledgeData: KnowledgeData): Repo | undefined {
  const workspaces = getWorkspaces(knowledgeData.repos);
  const { workspaceID } = useParams<{
    workspaceID: string;
  }>() as { workspaceID?: string };
  const a =
    workspaceID ||
    knowledgeData.activeWorkspace ||
    workspaces.first({ id: undefined }).id;
  if (!a) {
    throw new Error("No Available Workspace");
  }
  const activeWorkspace = workspaces.get(a);
  const workspace = activeWorkspace || workspaces.first(undefined);
  if (!workspace) {
    throw new Error("No Available Workspace");
  }
  return workspace;
}

function addNewWorkspaceIfNeeded(data: KnowledgeData): KnowledgeData {
  const workspaces = getWorkspaces(data.repos);
  if (workspaces.size === 0) {
    const repo = newRepo(newNode("My first Workspace", "WORKSPACE"));
    return {
      ...data,
      repos: data.repos.set(repo.id, repo),
      activeWorkspace: repo.id,
    };
  }
  return data;
}

function selectedWorkspaceBranch(
  workspace: Repo | undefined
): BranchPath | undefined {
  if (!workspace) {
    return undefined;
  }
  return getDefaultBranch(workspace);
}

export function useUpdateKnowledge(): (
  toUpdate: Partial<KnowledgeData>
) => void {
  const { setKnowledgeData, data } = getDataContextOrThrow();
  return (toUpdate) => {
    setKnowledgeData({
      ...data,
      ...toUpdate,
    });
  };
}

export function usePublishData(): {
  hasUnpublishedData: boolean;
  publishKnowledgeData: () => Promise<void>;
} {
  const context = getDataContextOrThrow();
  return {
    hasUnpublishedData: context.hasUnpublishedData,
    publishKnowledgeData: context.publishKnowledgeData,
  };
}

export function getWorkspaceInfo(workspace: KnowNode): {
  title: string;
} {
  const divided = workspace.text.split(":");
  if (divided.length === 1) {
    return { title: workspace.text };
  }
  return {
    title: divided.slice(0, divided.length - 1).join(),
  };
}

export function useGetNodeText(): (node: KnowNode) => string {
  return (node: KnowNode) => {
    if (node.nodeType === "WORKSPACE") {
      return getWorkspaceInfo(node).title;
    }
    return node.text;
  };
}

type WorkspaceData = {
  title: string;
};

// TODO: what if this is new?
export function useWorkspace(): WorkspaceData {
  const knowledgeData = useKnowledgeData();
  const workspaceRepo = getWorkspaceRepo(knowledgeData);
  const workspaceBranch = selectedWorkspaceBranch(workspaceRepo);
  if (!workspaceRepo || !workspaceBranch) {
    return {
      title: "New Workspace",
    };
  }

  const workspaceNode = getNode(workspaceRepo, workspaceBranch);

  const { title } = getWorkspaceInfo(workspaceNode);
  return {
    title,
  };
}

export function KnowledgeDataProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const { user, relays, contacts, contactsOfContacts } = useData();
  const { createPlan, executePlan } = usePlanner();
  const readFromRelays = relays.filter((r) => r.read === true);

  const [knowledgeDBs, dbsReady] = useKnowledgeQuery(
    contacts
      .merge(contactsOfContacts)
      .set(user.publicKey, user)
      .keySeq()
      .toArray(),
    user.publicKey,
    true,
    readFromRelays
  );

  const knowledge = mergeKnowledgeData(knowledgeDBs, user.publicKey);
  const [knowledgeStatus, setKnowledgeStatus] = useState<{
    diff: KnowledgeDiff<BranchWithCommits | BranchWithStaged>;
    unsaved: boolean;
  }>({ diff: {}, unsaved: false });

  if (!dbsReady) {
    return <div className="loading" aria-label="loading" />;
  }

  const setKnowledgeData = (data: KnowledgeData): void => {
    const diff = compareKnowledgeDB(knowledge, data);
    setKnowledgeStatus({ diff, unsaved: true });
  };
  const knowledgeData = addNewWorkspaceIfNeeded(
    applyDiff(knowledge, knowledgeStatus.diff)
  );

  const saveKnowledgeData = async (): Promise<void> => {
    const committedRepos = knowledgeData.repos.map((repo) => {
      return commitAllBranches(repo);
    });
    const dataWithCommittedRepos: KnowledgeData<BranchWithCommits> = {
      ...knowledgeData,
      repos: committedRepos,
    };

    const myDB = knowledgeDBs.get(user.publicKey, newDB());
    // Compare the full database incl. my changes and commits from all others
    // with only myDB and store that diff for max. data availability
    const diffWithCommits = compareKnowledgeDB<BranchWithCommits>(
      myDB,
      dataWithCommittedRepos
    );

    await executePlan(planSetKnowledgeData(createPlan(), diffWithCommits));
    setKnowledgeStatus({ diff: diffWithCommits, unsaved: false });
  };

  return (
    <RelationContext.Provider
      value={{
        data: knowledgeData,
        publishKnowledgeData: saveKnowledgeData,
        hasUnpublishedData: knowledgeStatus.unsaved,
        setKnowledgeData,
      }}
    >
      <ViewContextProvider root={knowledgeData.activeWorkspace}>
        {children}
      </ViewContextProvider>
    </RelationContext.Provider>
  );
}

export function OverwriteKnowledgeDataContext({
  children,
  updateData,
}: {
  children: React.ReactNode;
  updateData: (knowledgeData: KnowledgeData) => KnowledgeData;
}): JSX.Element {
  const existingContext = getDataContextOrThrow();
  return (
    <RelationContext.Provider
      value={{
        ...existingContext,
        data: updateData(existingContext.data),
      }}
    >
      {children}
    </RelationContext.Provider>
  );
}
