import { List } from "immutable";
import { useParams } from "react-router-dom";
import { useData } from "./DataContext";
import { getNodeFromID } from "./ViewContext";

export function shorten(nodeText: string): string {
  return nodeText.substr(0, 30);
}

export function getWorkspaces(data: Data): List<KnowNode> {
  const myWorkspaces = data.workspaces.map((id) =>
    getNodeFromID(data.knowledgeDBs, id)
  );
  return data.contactsWorkspaces
    .reduce((rdx, wsIDs) => {
      const workspaces = wsIDs.map((id) =>
        getNodeFromID(data.knowledgeDBs, id)
      );
      return workspaces.merge(rdx);
    }, myWorkspaces)
    .filter((n) => n !== undefined) as List<KnowNode>;
}

export function useWorkspaceFromURL(): ID | undefined {
  const params = useParams<{
    workspaceID?: ID;
  }>();
  return params.workspaceID;
}

export function useWorkspace(): string {
  const { knowledgeDBs, activeWorkspace: a } = useData();
  const activeWorkspace = useWorkspaceFromURL() || a;
  const node = getNodeFromID(knowledgeDBs, activeWorkspace);
  if (!node) {
    return "New Workspace";
  }
  return node.text;
}
