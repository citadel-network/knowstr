import React, { useState } from "react";
import {
  Button,
  Dropdown,
  Form,
  FormControl,
  InputGroup,
  Modal,
} from "react-bootstrap";
import { CirclePicker } from "react-color";
import { v4 } from "uuid";
import {
  Plan,
  planUpdateRelationTypes,
  planUpdateViews,
  planUpsertRelations,
  usePlanner,
} from "../planner";
import { useData } from "../DataContext";
import { newDB } from "../knowledge";
import { getRelations, splitID } from "../connections";
import { newRelations, updateView, useNode, useViewPath } from "../ViewContext";

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

export type NewRelationTypeProps = {
  onHide: () => void;
};

export function NewRelationType({ onHide }: NewRelationTypeProps): JSX.Element {
  const [color, setColor] = useState<string>(COLORS[0]);
  const { createPlan, executePlan } = usePlanner();
  const { user, knowledgeDBs } = useData();
  const onSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const form = event.currentTarget;
    if (form.checkValidity() === false) {
      return;
    }
    const id = v4();
    const label = (form.elements.namedItem("name") as HTMLInputElement).value;
    const myDB = knowledgeDBs.get(user.publicKey, newDB());
    executePlan(
      planUpdateRelationTypes(
        createPlan(),
        myDB.relationTypes.set(id, { color, label })
      )
    );
    onHide();
  };
  return (
    <Modal show onHide={onHide}>
      <Modal.Header closeButton>New Relation Type</Modal.Header>
      <Form onSubmit={onSubmit}>
        <Modal.Body>
          <InputGroup>
            <InputGroup.Text>Name of Relation Type</InputGroup.Text>
            <FormControl
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

export function getMyRelationTypes(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey
): RelationTypes {
  return knowledgeDBs.get(myself, newDB()).relationTypes;
}

export function getRelationTypeByRelationsID(
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  relationsID: ID
): [RelationType, ID] | [undefined, undefined] {
  const relations = getRelations(knowledgeDBs, relationsID, myself);
  if (!relations) {
    return [undefined, undefined];
  }
  const [remote] = splitID(relationsID);
  const relationTypeID = relations.type;
  const relationType = knowledgeDBs
    .get(remote || myself, newDB())
    .relationTypes.get(relationTypeID);
  if (!relationType || !relationTypeID) {
    return [undefined, undefined];
  }
  return [relationType, relationTypeID];
}

export function planCopyRelationsTypeIfNecessary(
  plan: Plan,
  relationsID: ID
): Plan {
  const [relationType, relationTypeID] = getRelationTypeByRelationsID(
    plan.knowledgeDBs,
    plan.user.publicKey,
    relationsID
  );
  if (!relationType) {
    return plan;
  }
  const myRelationTypes = getMyRelationTypes(
    plan.knowledgeDBs,
    plan.user.publicKey
  );
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
  const { knowledgeDBs, user } = useData();
  const [node, view] = useNode();
  const { views } = knowledgeDBs.get(user.publicKey, newDB());
  const viewPath = useViewPath();
  const { createPlan, executePlan } = usePlanner();
  const relationType = getMyRelationTypes(knowledgeDBs, user.publicKey).get(
    relationTypeID,
    { color: DEFAULT_COLOR, label: "default" }
  );

  const onClick = (): void => {
    if (!node) {
      throw new Error("Node not found");
    }
    const relations = newRelations(node.id, relationTypeID, user.publicKey);
    const createRelationPlan = planUpsertRelations(createPlan(), relations);
    const plan = planUpdateViews(
      createRelationPlan,
      updateView(views, viewPath, {
        ...view,
        relations: relations.id,
        expanded: true,
      })
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
