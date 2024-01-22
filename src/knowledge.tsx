import { List, Map, OrderedMap } from "immutable";
import { DEFAULT_COLOR } from "./components/RelationTypes";

export function newDB(): KnowledgeData {
  return {
    nodes: Map<ID, KnowNode>(),
    relations: Map<ID, Relations>(),
    views: Map<string, View>(),
    activeWorkspace: "my-first-workspace" as LongID,
    workspaces: List<ID>(),
    relationTypes: OrderedMap<ID, RelationType>().set("" as ID, {
      color: DEFAULT_COLOR,
      label: "Default",
    }),
  };
}
