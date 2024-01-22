import React, { useState } from "react";
import { Dropdown, Modal } from "react-bootstrap";
import {
  getAvailableRelationsForNode,
  updateView,
  useNode,
  useViewKey,
  useViewPath,
  viewPathToString,
} from "../ViewContext";
import {
  closeEditor,
  useDeselectAllInView,
  useTemporaryView,
} from "./TemporaryViewContext";
import { getRelations } from "../connections";
import { getLevels, useIsOpenInFullScreen } from "./Node";
import { useData } from "../DataContext";
import { planUpdateViews, usePlanner } from "../planner";
import { newDB } from "../knowledge";
import {
  AddNewRelationsToNodeItem,
  NewRelationType,
  getMyRelationTypes,
  getRelationTypeByRelationsID,
} from "./RelationTypes";

type ShowRelationsButtonProps = {
  id: LongID;
  readonly?: boolean;
  hideWhenZero?: boolean;
  alwaysOneSelected?: boolean;
};

function AddRelationsButton(): JSX.Element {
  const { knowledgeDBs, user } = useData();
  const [newRelationType, setNewRelationType] = useState<boolean>(false);
  const [node] = useNode();
  const ariaLabel = `Add new Relations to ${node?.text || ""}`;
  const relationTypes = getMyRelationTypes(knowledgeDBs, user.publicKey);
  return (
    <Dropdown>
      {newRelationType && (
        <NewRelationType onHide={() => setNewRelationType(false)} />
      )}
      <Dropdown.Toggle
        as="button"
        className="btn select-relation"
        aria-label={ariaLabel}
      >
        <span>+</span>
      </Dropdown.Toggle>
      <Dropdown.Menu popperConfig={{ strategy: "fixed" }} renderOnMount>
        {relationTypes
          .keySeq()
          .toArray()
          .map((id) => (
            <AddNewRelationsToNodeItem key={id} relationTypeID={id} />
          ))}
        <Dropdown.Divider />
        <Dropdown.Item onClick={() => setNewRelationType(true)} tabIndex={0}>
          <div className="workspace-selection-text">New Relation Type</div>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
  /*
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="btn select-relation"
      onClick={() => {}}
    >
      <span className="">+</span>
    </button>
  );
   */
}

function ShowRelationsButton({
  id,
  readonly: ro,
  hideWhenZero,
  alwaysOneSelected,
}: ShowRelationsButtonProps): JSX.Element | null {
  const [node, view] = useNode();
  const { knowledgeDBs, user } = useData();
  const { createPlan, executePlan } = usePlanner();
  const readonly = ro === true;
  const viewPath = useViewPath();
  const viewKey = useViewKey();
  const { editorOpenViews, setEditorOpenState } = useTemporaryView();
  const isFullScreen = useIsOpenInFullScreen();
  const deselectAllInView = useDeselectAllInView();
  if (!node || !view) {
    return <></>;
  }

  const relations = getRelations(knowledgeDBs, id, user.publicKey, node.id);
  const [relationType] =
    id === "social"
      ? [{ label: "Social", color: "black" }]
      : getRelationTypeByRelationsID(knowledgeDBs, user.publicKey, id);
  const relationSize = relations ? relations.items.size : 0;
  if (hideWhenZero && relationSize === 0) {
    return null;
  }
  const isFirstLevelAddToNode = getLevels(viewPath, isFullScreen) === 0;
  const viewKeyOfAddToNode = isFirstLevelAddToNode
    ? viewKey
    : viewPathToString({
        ...viewPath,
        indexStack: viewPath.indexStack.push(relationSize),
      });
  if (readonly) {
    return (
      <div className="flex-start deselected">
        <span className="font-size-small pe-1">{relationSize}</span>
      </div>
    );
  }

  const isExpanded = view.expanded === true;
  const ariaLabel =
    isExpanded && view.relations === relations?.id
      ? `hide ${relations?.type || "list"} items of ${node.text}`
      : `show ${relations?.type || "list"} items of ${node.text}`;

  const isSelected =
    (isExpanded || alwaysOneSelected) && view.relations === relations?.id;
  const className = `btn select-relation ${
    isSelected ? "opacity-none" : "deselected"
  }`;
  const onChangeRelations = (newRelations: LongID, expand: boolean): void => {
    const { views } = knowledgeDBs.get(user.publicKey, newDB());
    const plan = planUpdateViews(
      createPlan(),
      updateView(views, viewPath, {
        ...view,
        relations: newRelations,
        expanded: expand,
      })
    );
    executePlan(plan);
    setEditorOpenState(closeEditor(editorOpenViews, viewKeyOfAddToNode));
    deselectAllInView(viewKey);
  };
  const onToggleExpanded = (expand: boolean): void => {
    const { views } = knowledgeDBs.get(user.publicKey, newDB());
    const plan = planUpdateViews(
      createPlan(),
      updateView(views, viewPath, {
        ...view,
        expanded: expand,
      })
    );
    executePlan(plan);
    if (!expand) {
      setEditorOpenState(closeEditor(editorOpenViews, viewKeyOfAddToNode));
    }
  };
  const style = relationType
    ? {
        backgroundColor: relationType.color,
        borderColor: relationType.color,
        color: "white",
      }
    : {};
  const label = isSelected
    ? `${relationType?.label || "Unknown"} (${relationSize})`
    : relationSize;
  const preventDeselect = isSelected && alwaysOneSelected;
  const onClick = preventDeselect
    ? undefined
    : () => {
        if (view.relations === id) {
          onToggleExpanded(!isExpanded);
        } else {
          onChangeRelations(id, true);
        }
      };
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={className}
      disabled={preventDeselect}
      style={style}
      onClick={onClick}
    >
      {id === "social" && <span className="iconsminds-conference" />}
      <span className="">{label}</span>
    </button>
  );
}

export function SelectRelations({
  readonly,
  alwaysOneSelected,
}: {
  readonly?: boolean;
  alwaysOneSelected?: boolean;
}): JSX.Element | null {
  const { knowledgeDBs, user } = useData();
  const [node] = useNode();
  if (!node) {
    return null;
  }
  const relations = getAvailableRelationsForNode(
    knowledgeDBs,
    user.publicKey,
    node.id
  );
  return (
    <>
      {relations.toArray().map((relation) => (
        <ShowRelationsButton
          key={relation.id}
          id={relation.id}
          readonly={readonly}
          alwaysOneSelected={alwaysOneSelected}
        />
      ))}
      <ShowRelationsButton
        id={"social" as LongID}
        hideWhenZero
        alwaysOneSelected={alwaysOneSelected}
      />
      {!readonly && <AddRelationsButton />}
    </>
  );
}
