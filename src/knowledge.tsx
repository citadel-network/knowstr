import { List, Map, OrderedMap } from "immutable";
import { DEFAULT_COLOR } from "./components/RelationTypes";

export function newDB(): KnowledgeData {
  return {
    nodes: Map<ID, KnowNode>(),
    relations: Map<ID, Relations>(),
  };
}
