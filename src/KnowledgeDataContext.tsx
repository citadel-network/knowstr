import { List } from "immutable";
import { useParams } from "react-router-dom";
import { useData } from "./DataContext";
import { getNodeFromID } from "./ViewContext";

export function shorten(nodeText: string): string {
  return nodeText.substr(0, 30);
}

export function getWorkspaces(data: Data): List<KnowNode> {
  const myWorkspaces = data.workspaces.map((id) =>
    getNodeFromID(data.knowledgeDBs, id, data.user.publicKey)
  );
  return data.contactsWorkspaces
    .reduce((rdx, wsIDs) => {
      const workspaces = wsIDs.map((id) =>
        getNodeFromID(data.knowledgeDBs, id, data.user.publicKey)
      );
      return workspaces.merge(rdx);
    }, myWorkspaces)
    .filter((n) => n !== undefined) as List<KnowNode>;
}

export function useWorkspaceFromURL(): LongID | undefined {
  const params = useParams<{
    workspaceID?: LongID;
  }>();
  return params.workspaceID;
}

export const DEFAULT_WS_NAME = "My first Workspace";

export function useWorkspace(): string {
  const { knowledgeDBs, user, activeWorkspace: a } = useData();
  const activeWorkspace = useWorkspaceFromURL() || a;
  const node = getNodeFromID(knowledgeDBs, activeWorkspace, user.publicKey);
  if (!node) {
    return DEFAULT_WS_NAME;
  }
  return node.text;
}
