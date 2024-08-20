import { List, Set } from "immutable";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useData } from "./DataContext";
import { getNodeFromID } from "./ViewContext";

export function shorten(nodeText: string): string {
  return nodeText.substr(0, 30);
}

export function getWorkspaces(data: Data): List<KnowNode> {
  const allWorkspaces: Set<LongID | ID> = (
    data.contactsWorkspaces.valueSeq().toList().flatten(1) as List<LongID>
  )
    .concat(data.workspaces)
    .concat([data.activeWorkspace as LongID])
    .toSet();

  const nodes = allWorkspaces
    .map((wsID) => getNodeFromID(data.knowledgeDBs, wsID, data.user.publicKey))
    .filter((n) => n !== undefined) as Set<KnowNode>;
  return nodes.toList();
}

export function useWorkspaceFromURL(): LongID | undefined {
  const params = useParams<{
    workspaceID?: LongID;
  }>();
  const wsID = params.workspaceID;
  const [lastWSFromURL, setLastWSFromURL] = useState<LongID | undefined>(wsID);
  useEffect(() => {
    if (wsID !== lastWSFromURL && wsID) {
      setLastWSFromURL(wsID);
    }
  }, [wsID]);
  return lastWSFromURL;
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
