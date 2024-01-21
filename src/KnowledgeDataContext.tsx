import { List } from "immutable";
import { newDB } from "./knowledge";
import { shortID } from "./connections";
import { useData } from "./DataContext";
import { getNodeFromID } from "./ViewContext";

export function shorten(nodeText: string): string {
  return nodeText.substr(0, 30);
}

export function getWorkspaces(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey
): List<KnowNode> {
  const myDB = knowledgeDBs.get(myself, newDB());
  const myWorkspaces = myDB.workspaces.map((id) => myDB.nodes.get(shortID(id)));
  return knowledgeDBs
    .filter((db, key) => key !== myself)
    .reduce((rdx, db) => {
      const workspaces = db.workspaces.map((id) => db.nodes.get(shortID(id)));
      return rdx.merge(workspaces);
    }, myWorkspaces)
    .filter((n) => n !== undefined) as List<KnowNode>;
}

export function useWorkspace(): string {
  const { knowledgeDBs, user } = useData();
  const myDB = knowledgeDBs.get(user.publicKey, newDB());
  const { activeWorkspace } = myDB;
  const node = getNodeFromID(knowledgeDBs, activeWorkspace, user.publicKey);
  if (!node) {
    return "New Workspace";
  }
  return node.text;
}
