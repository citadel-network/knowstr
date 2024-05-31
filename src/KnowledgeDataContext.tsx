import { List } from "immutable";
import { useParams } from "react-router-dom";
import { newDB } from "./knowledge";
import { shortID } from "./connections";
import { useData } from "./DataContext";
import { getNodeFromID } from "./ViewContext";

export function shorten(nodeText: string): string {
  return nodeText.substr(0, 30);
}

export function getWorkspaces(data: Data): List<KnowNode> {
  const myDB = data.knowledgeDBs.get(data.user.publicKey, newDB());
  const myWorkspaces = data.workspaces.map((id) => myDB.nodes.get(shortID(id)));
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

export function useWorkspace(): string {
  const { knowledgeDBs, user, activeWorkspace: a } = useData();
  const activeWorkspace = useWorkspaceFromURL() || a;
  const node = getNodeFromID(knowledgeDBs, activeWorkspace, user.publicKey);
  if (!node) {
    return "New Workspace";
  }
  return node.text;
}
