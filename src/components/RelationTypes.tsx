import React, { useEffect, useState } from "react";
import { Card, Dropdown } from "react-bootstrap";
import { CirclePicker } from "react-color";
import { v4 } from "uuid";
import { Button, CloseButton, ModalForm } from "citadel-commons";
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

export function NewRelationType({
  onAddRelationType,
  usedColors,
  className,
}: {
  onAddRelationType: (newRelationType: RelationType) => void;
  usedColors: Array<string>;
  className?: string;
}): JSX.Element {
  const [isEditingColor, setIsEditingColor] = useState<boolean>(false);
  const [color, setColor] = useState<string>(
    getFirstUnusedRelationTypeColor(usedColors)
  );
  const ref = React.createRef<ReactQuill>();
  useEffect(() => {
    if (ref.current) {
      ref.current.getEditor().setText("");
      ref.current.focus();
    }
  }, []);
  const onSave = (): void => {
    if (!ref.current) {
      return;
    }
    const text = ref.current.getEditor().getText();
    const isNewLineAdded = text.endsWith("\n");
    onAddRelationType({
      color,
      label: isNewLineAdded ? text.slice(0, -1) : text,
    });
    ref.current.getEditor().setText("");
    ref.current.focus();
    setColor(getFirstUnusedRelationTypeColor([...usedColors, color]));
  };

  return (
    <>
      <div className="flex-row-space-between">
        <div
          className={`flex-row-start align-center ${className || "m-1"} w-100`}
        >
          <button
            type="button"
            className="btn-borderless relation-type-selection-color"
            style={{
              backgroundColor: color,
              cursor: "pointer",
            }}
            aria-label="color of new relationType"
            onClick={() => setIsEditingColor(!isEditingColor)}
          />
          <div className="ps-2 flex-grow-1">
            <div className="border-strong">
              <ReactQuillWrapper
                ref={ref}
                className="m-1"
                placeholder="Add Relation Type"
              />
            </div>
          </div>
        </div>
        <div className="flex-col-center">
          <div className="flex-row-end">
            <Button
              className="btn simple-icon-check"
              onClick={() => {
                onSave();
              }}
              ariaLabel="save new relationType"
            />
          </div>
        </div>
      </div>
      {isEditingColor && (
        <div className="flex-row-start m-1">
          <CirclePicker
            width="100%"
            color={color}
            colors={COLORS}
            onChange={(c) => setColor(c.hex)}
          />
        </div>
      )}
    </>
  );
}

function NewRelationTypeCard({
  onAddRelationType,
  usedColors,
}: {
  onAddRelationType: (newRelationType: RelationType) => void;
  usedColors: Array<string>;
}): JSX.Element {
  return (
    <Card className="p-3 m-2 mt-3 mb-3 border-strong">
      <NewRelationType
        onAddRelationType={onAddRelationType}
        usedColors={usedColors}
      />
    </Card>
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
      quill.setText("");
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
      aria-label={`relation type details ${
        relationType.label || "Unnamed Type"
      }`}
    >
      <div className="flex-row-space-between">
        <div className="flex-row-start align-center m-1 w-100">
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
            aria-label={
              relationType.label
                ? `edit color of relationType ${relationType.label}`
                : "edit color of Unnamed Type"
            }
          />
          <div className="ps-2 flex-grow-1">
            {isEditing.editLabel ? (
              <ReactQuillWrapper ref={ref} className="m-1" />
            ) : (
              <div className={relationType.label ? "m-1" : "m-1 italic"}>
                {relationType.label || "Unnamed Type"}
              </div>
            )}
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
              ariaLabel={
                relationType.label
                  ? `edit relationType ${relationType.label}`
                  : "edit Unnamed Type"
              }
            />
          )}
        </div>
      </div>
      {isEditing.editColor && (
        <div className="flex-row-start m-1">
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
  const onAddRelationType = (newRelationType: RelationType): void => {
    const id = v4();
    setRelationTypeState(relationTypeState.set(id, newRelationType));
  };
  const onUpdateRelationType = (
    id: string,
    oldRelationType: RelationType,
    newRelationType: RelationType
  ): void => {
    if (
      newRelationType.label !== oldRelationType.label ||
      newRelationType.color !== oldRelationType.color
    ) {
      setRelationTypeState(relationTypeState.set(id, newRelationType));
    }
  };
  return (
    <ModalForm
      submit={() => onSubmit(relationTypeState)}
      onHide={() => navigate("/")}
      title="Edit Relation Types"
    >
      <div className="scroll">
        <NewRelationTypeCard
          onAddRelationType={onAddRelationType}
          usedColors={relationTypeState
            .toArray()
            .map(([, relType]) => relType.color)}
        />
        {relationTypeState.toArray().map(([id, relType]) => {
          return (
            <div key={id}>
              <RelationTypeCard
                relationType={relType}
                onUpdateRelationType={(newRelationType) =>
                  onUpdateRelationType(id, relType, newRelationType)
                }
              />
            </div>
          );
        })}
      </div>
    </ModalForm>
  );
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
  const [remote] = splitID(relationsID);
  const relationTypeID = relations.type;

  const relationType =
    (remote &&
      isRemote(remote, data.user.publicKey) &&
      data.contactsRelationTypes.get(remote)?.get(relationTypeID)) ||
    data.relationTypes.get(relationTypeID);
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
  const myRelationTypes = plan.relationTypes;
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
  const { relationTypes } = useData();
  const [node, view] = useNode();
  const viewPath = useViewPath();
  const { createPlan, executePlan } = usePlanner();
  const relationType = relationTypes.get(relationTypeID, {
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
