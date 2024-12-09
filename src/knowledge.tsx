import { Map } from "immutable";

export function newDB(): KnowledgeData {
  return {
    nodes: Map<ID, KnowNode>(),
    relations: Map<ID, Relations>(),
  };
}

export function isProjectNode(node: KnowNode): node is ProjectNode {
  return node.type === "project";
}
