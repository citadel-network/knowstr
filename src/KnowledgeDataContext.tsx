import { useEffect, useState } from "react";
import { List, Set } from "immutable";
import { useParams } from "react-router-dom";
import { getNodeFromID } from "./ViewContext";

export function shorten(nodeText: string): string {
  return nodeText.substr(0, 30);
}

export function getWorkspacesWithNodes(
  workspaces: Set<string | LongID>,
  data: Data
): List<KnowNode> {
  return (
    workspaces
      .map((wsID) =>
        getNodeFromID(data.knowledgeDBs, wsID, data.user.publicKey)
      )
      .filter((n) => n !== undefined) as Set<KnowNode>
  ).toList();
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
