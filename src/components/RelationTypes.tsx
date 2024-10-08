import React from "react";
import { Dropdown } from "react-bootstrap";
import { OrderedMap } from "immutable";
import {
  Plan,
  planUpdateViews,
  planUpsertRelations,
  usePlanner,
} from "../planner";
import { REFERENCED_BY, SOCIAL, getRelationsNoSocial } from "../connections";
import {
  ViewPath,
  newRelations,
  updateView,
  useNode,
  useViewPath,
} from "../ViewContext";

export const DEFAULT_COLOR = "#027d86";

export const COLORS = [
  "#9c27b0",
  "#673ab7",
  "#3f51b5",
  "#032343",
  "#738dbb",
  "#2196f3",
  "#00bcd4",
  "#009688",
  "#4caf50",
  "#8bc34a",
  "#a1cb58",
  "#e7c550",
  "#ffc859",
  "#ff9800",
  "#8f2c3b",
  "#c30202",
  "#bf4d3e",
  "#795548",
];

export const RELATION_TYPES = OrderedMap<RelationType>({
  "": { color: DEFAULT_COLOR, label: "Relevant For" },
  little_relevant: { color: COLORS[3], label: "Little Relevant For" },
  maybe_relevant: { color: COLORS[5], label: "Maybe Relevant For" },
  not_relevant: { color: COLORS[0], label: "Not Relevant For" },
  confirms: { color: COLORS[9], label: "Confirms" },
  contains: { color: COLORS[2], label: "Contains" },
  contra: { color: COLORS[15], label: "Contradicts" },
});

export function useGetAllRelationTypes(): RelationTypes {
  return RELATION_TYPES;
}

export function planAddNewRelationToNode(
  plan: Plan,
  nodeID: LongID,
  relationTypeID: ID,
  view: View,
  viewPath: ViewPath
): Plan {
  const relations = newRelations(nodeID, relationTypeID, plan.user.publicKey);
  const createRelationPlan = planUpsertRelations(plan, relations);
  return planUpdateViews(
    createRelationPlan,
    updateView(plan.views, viewPath, {
      ...view,
      relations: relations.id,
      expanded: true,
    })
  );
}

export function getFirstUnusedRelationTypeColor(
  usedColors: Array<string>
): string {
  const colors = COLORS.filter((color) => !usedColors.some((c) => c === color));
  return colors[0] || COLORS[0];
}

export function getRelationTypeByRelationsID(
  data: Data,
  relationsID: ID
): [RelationType | undefined, ID] | [undefined, undefined] {
  const relations = getRelationsNoSocial(
    data.knowledgeDBs,
    relationsID,
    data.user.publicKey
  );
  if (!relations || relationsID === SOCIAL || relationsID === REFERENCED_BY) {
    return [undefined, undefined];
  }
  const relationTypeID = relations.type;

  const relationType = RELATION_TYPES.get(relationTypeID);
  return [relationType, relationTypeID];
}

export function AddNewRelationsToNodeItem({
  relationTypeID,
}: {
  relationTypeID: ID;
}): JSX.Element | null {
  const [node, view] = useNode();
  const viewPath = useViewPath();
  const { createPlan, executePlan } = usePlanner();
  const allRelationTypes = useGetAllRelationTypes();
  const relationType = allRelationTypes.get(relationTypeID, {
    color: DEFAULT_COLOR,
    label: "unknown",
  });

  const onClick = (): void => {
    if (!node) {
      throw new Error("Node not found");
    }
    const plan = planAddNewRelationToNode(
      createPlan(),
      node.id,
      relationTypeID,
      view,
      viewPath
    );
    executePlan(plan);
  };

  return (
    <Dropdown.Item className="d-flex workspace-selection" onClick={onClick}>
      <div
        className="relation-type-selection-color"
        style={{
          backgroundColor: relationType.color,
        }}
      />
      <div
        className={
          relationType.label
            ? "workspace-selection-text"
            : "workspace-selection-text italic"
        }
      >
        {relationType.label || "Unnamed Type"}
      </div>
    </Dropdown.Item>
  );
}
