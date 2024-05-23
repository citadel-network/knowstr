import React, { useState } from "react";
import { Button, Dropdown, Form, InputGroup, Modal } from "react-bootstrap";
import { CirclePicker } from "react-color";
import { FormControlWrapper } from "citadel-commons";
import {
  Plan,
  planUpdateRelationTypes,
  planUpdateViews,
  planUpsertRelations,
  usePlanner,
} from "../planner";
import { useData } from "../DataContext";
import {
  REFERENCED_BY,
  SOCIAL,
  getRelationsNoSocial,
  isRemote,
  newID,
} from "../connections";
import {
  ViewPath,
  newRelations,
  updateView,
  useNode,
  useViewPath,
} from "../ViewContext";

export const DEFAULT_COLOR = "#027d86";

const COLORS = [
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

type NewRelationTypeProps = {
  onHide: () => void;
};

function planAddNewRelationToNode(
  plan: Plan,
  nodeID: ID,
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

export function NewRelationType({ onHide }: NewRelationTypeProps): JSX.Element {
  const [color, setColor] = useState<string>(COLORS[0]);
  const { createPlan, executePlan } = usePlanner();
  const { relationTypes } = useData();
  const [node, view] = useNode();
  const viewPath = useViewPath();
  const onSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const form = event.currentTarget;
    if (form.checkValidity() === false) {
      return;
    }
    const id = newID();
    const label = (form.elements.namedItem("name") as HTMLInputElement).value;
    const updateRelationTypesPlan = planUpdateRelationTypes(
      createPlan(),
      relationTypes.set(id, { color, label })
    );
    if (node && view) {
      executePlan(
        planAddNewRelationToNode(
          updateRelationTypesPlan,
          node.id,
          id,
          view,
          viewPath
        )
      );
    } else {
      executePlan(updateRelationTypesPlan);
    }
    onHide();
  };
  return (
    <Modal show onHide={onHide}>
      <Modal.Header closeButton>New Relation Type</Modal.Header>
      <Form onSubmit={onSubmit}>
        <Modal.Body>
          <InputGroup>
            <InputGroup.Text>Name of Relation Type</InputGroup.Text>
            <FormControlWrapper
              aria-label="Name of new Relation Type"
              name="name"
              required
            />
          </InputGroup>
          <CirclePicker
            width="100%"
            color={color}
            colors={COLORS}
            onChange={(c) => setColor(c.hex)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button type="submit" tabIndex={0}>
            Create Label
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export function getMyRelationTypes(data: Data): RelationTypes {
  return data.relationTypes;
}

export function getRelationTypeByRelationsID(
  data: Data,
  relationsID: ID
): [RelationType, ID] | [undefined, undefined] {
  const relations = getRelationsNoSocial(data.knowledgeDBs, relationsID);
  if (!relations || relationsID === SOCIAL || relationsID === REFERENCED_BY) {
    return [undefined, undefined];
  }
  const relationTypeID = relations.type;

  const relationType =
    (isRemote(relations.author, data.user.publicKey) &&
      data.contactsRelationTypes.get(relations.author)?.get(relationTypeID)) ||
    data.relationTypes.get(relationTypeID);

  if (!relationType || relationTypeID === undefined) {
    return [undefined, undefined];
  }
  return [relationType, relationTypeID];
}

export function planCopyRelationsTypeIfNecessary(
  plan: Plan,
  relationsID: ID
): Plan {
  if (relationsID === SOCIAL || relationsID === REFERENCED_BY) {
    return plan;
  }
  const [relationType, relationTypeID] = getRelationTypeByRelationsID(
    plan,
    relationsID
  );
  if (!relationType) {
    return plan;
  }
  const myRelationTypes = getMyRelationTypes(plan);
  if (myRelationTypes.has(relationTypeID)) {
    return plan;
  }
  return planUpdateRelationTypes(
    plan,
    myRelationTypes.set(relationTypeID, relationType)
  );
}

export function AddNewRelationsToNodeItem({
  relationTypeID,
}: {
  relationTypeID: ID;
}): JSX.Element | null {
  const data = useData();
  const [node, view] = useNode();
  const viewPath = useViewPath();
  const { createPlan, executePlan } = usePlanner();
  const relationType = getMyRelationTypes(data).get(relationTypeID, {
    color: DEFAULT_COLOR,
    label: "default",
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
      <div className="workspace-selection-text">{relationType.label}</div>
    </Dropdown.Item>
  );
}
