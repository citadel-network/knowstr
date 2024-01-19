import { Map } from "immutable";

export function newDB(): KnowledgeData {
  return {
    nodes: Map<ID, KnowNode>(),
    relations: Map<ID, Relations>(),
    views: Map<string, View>(),
  };
}
