import React, { useEffect, useState } from "react";
import {
  Button as BSButton,
  Card,
  Dropdown,
  Form,
  InputGroup,
  Modal,
} from "react-bootstrap";
import { CirclePicker } from "react-color";
import { v4 } from "uuid";
import {
  FormControlWrapper,
  Button,
  CloseButton,
  ModalForm,
} from "citadel-commons";
import { useNavigate } from "react-router-dom";
import ReactQuill from "react-quill";
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
  splitID,
} from "../connections";
import {
  ViewPath,
  newRelations,
  updateView,
  useNode,
  useViewPath,
} from "../ViewContext";
import { ReactQuillWrapper } from "./ReactQuillWrapper";

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
    const id = v4();
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
          <BSButton type="submit" tabIndex={0}>
            Create Label
          </BSButton>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

type EditButtonProps = {
  onClick: () => void;
  ariaLabel: string;
};

function EditButton({ onClick, ariaLabel }: EditButtonProps): JSX.Element {
  return (
    <Button
      onClick={onClick}
      className="btn font-size-small"
      ariaLabel={ariaLabel}
    >
      <span className="simple-icon-pencil" />
    </Button>
  );
}

type RelationTypeCardProps = {
  relationType: RelationType;
  onUpdateRelationType: (newRelationType: RelationType) => void;
};

function RelationTypeCard({
  relationType,
  onUpdateRelationType,
}: RelationTypeCardProps): JSX.Element {
  const [isEditing, setIsEditing] = useState<{
    editColor: boolean;
    editLabel: boolean;
  }>({ editColor: false, editLabel: false });
  const ref = React.createRef<ReactQuill>();

  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      const quill = ref.current.getEditor();
      quill.deleteText(0, 1000000);
      quill.insertText(0, relationType.label);
    }
  }, [isEditing.editLabel]);
  const onSave = (): void => {
    if (!ref.current) {
      return;
    }
    const text = ref.current.getEditor().getText();
    const isNewLineAdded = text.endsWith("\n");
    onUpdateRelationType({
      color: relationType.color,
      label: isNewLineAdded ? text.slice(0, -1) : text,
    });
  };

  return (
    <Card
      className="p-3 m-2 mt-3 mb-3 border-strong"
      aria-label={`relation details ${relationType.label}`}
    >
      <div className="flex-row-space-between">
        <div className="flex-row-start align-center m-1 mt-2 ">
          <button
            type="button"
            className="btn-borderless relation-type-selection-color"
            style={{
              backgroundColor: relationType.color,
              cursor: "pointer",
            }}
            onClick={() =>
              setIsEditing({ ...isEditing, editColor: !isEditing.editColor })
            }
            aria-label={`edit color of relationType ${relationType.label}`}
          />
          <div className="ms-2">
            <div className="flex-row-start w-100">
              {isEditing.editLabel ? (
                <ReactQuillWrapper ref={ref} />
              ) : (
                <>{relationType.label}</>
              )}
            </div>
          </div>
        </div>
        <div className="flex-col-center">
          {isEditing.editLabel ? (
            <div className="flex-row-end">
              <Button
                className="btn simple-icon-check"
                onClick={() => {
                  onSave();
                  setIsEditing({ ...isEditing, editLabel: false });
                }}
                ariaLabel="save"
              />
              <div className="ps-1">
                <CloseButton
                  onClose={() =>
                    setIsEditing({ ...isEditing, editLabel: false })
                  }
                />
              </div>
            </div>
          ) : (
            <EditButton
              onClick={() => setIsEditing({ ...isEditing, editLabel: true })}
              ariaLabel={`edit relationType ${relationType.label}`}
            />
          )}
        </div>
      </div>
      {isEditing.editColor && (
        <div className="flex-row start m-1">
          <CirclePicker
            width="100%"
            color={relationType.color}
            colors={COLORS}
            onChange={(c) => {
              onUpdateRelationType({
                color: c.hex,
                label: relationType.label,
              });
              setIsEditing({ ...isEditing, editColor: false });
            }}
          />
        </div>
      )}
    </Card>
  );
}

export function RelationTypes({
  relationTypes,
  onSubmit,
}: {
  relationTypes: RelationTypes;
  onSubmit: (relationTypeState: RelationTypes) => Promise<void>;
}): JSX.Element {
  const navigate = useNavigate();
  const [relationTypeState, setRelationTypeState] =
    useState<RelationTypes>(relationTypes);
  const updateRelationType = (
    updatedRelationType: RelationType,
    id: string
  ): void => {
    setRelationTypeState(relationTypeState.set(id, updatedRelationType));
  };
  return (
    <ModalForm
      submit={() => onSubmit(relationTypeState)}
      onHide={() => navigate("/")}
      title="Edit Relation Types"
    >
      <div className="scroll">
        {relationTypeState.toArray().map(([id, relType]) => {
          return (
            <div key={id}>
              <RelationTypeCard
                relationType={relType}
                onUpdateRelationType={(newRelationType) => {
                  if (
                    newRelationType.label !== relType.label ||
                    newRelationType.color !== relType.color
                  ) {
                    updateRelationType(newRelationType, id);
                  }
                }}
              />
            </div>
          );
        })}
      </div>
    </ModalForm>
  );
}

export function getMyRelationTypes(data: Data): RelationTypes {
  return data.relationTypes;
}

export function getRelationTypeByRelationsID(
  data: Data,
  relationsID: ID
): [RelationType, ID] | [undefined, undefined] {
  const relations = getRelationsNoSocial(
    data.knowledgeDBs,
    relationsID,
    data.user.publicKey
  );
  if (!relations || relationsID === SOCIAL || relationsID === REFERENCED_BY) {
    return [undefined, undefined];
  }
  const [remote] = splitID(relationsID);
  const relationTypeID = relations.type;

  const relationType =
    (remote &&
      isRemote(remote, data.user.publicKey) &&
      data.contactsRelationTypes.get(remote)?.get(relationTypeID)) ||
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
