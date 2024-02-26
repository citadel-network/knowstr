import React, { CSSProperties, useState } from "react";
import { Dropdown } from "react-bootstrap";
import { List } from "immutable";
import {
  addAddToNodeToPath,
  deleteChildViews,
  getAvailableRelationsForNode,
  getDefaultRelationForNode,
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
import { getRelations, isRemote, splitID } from "../connections";
import { useData } from "../DataContext";
import { planDeleteRelations, planUpdateViews, usePlanner } from "../planner";
import { newDB } from "../knowledge";
import {
  AddNewRelationsToNodeItem,
  NewRelationType,
  getMyRelationTypes,
  getRelationTypeByRelationsID,
} from "./RelationTypes";
import { useApis } from "../Apis";

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
        className="btn new-relation"
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
}

function DeleteRelationItem({ id }: { id: LongID }): JSX.Element | null {
  const { finalizeEvent } = useApis();
  const { createPlan, executePlan } = usePlanner();
  const { knowledgeDBs, user } = useData();
  const viewPath = useViewPath();
  const [node, view] = useNode();
  if (!view) {
    return null;
  }

  const onClick = (): void => {
    const { views } = knowledgeDBs.get(user.publicKey, newDB());
    const deleteRelationsPlan = planDeleteRelations(
      createPlan(),
      id,
      finalizeEvent
    );
    // TODO: deleteChildViews should only be necessary for the deleted relation not the other
    const plan = planUpdateViews(
      deleteRelationsPlan,
      updateView(deleteChildViews(views, viewPath), viewPath, {
        ...view,
        relations: getDefaultRelationForNode(
          node.id,
          deleteRelationsPlan.knowledgeDBs,
          user.publicKey
        ),
      }),
      finalizeEvent
    );
    executePlan(plan);
  };
  return (
    <Dropdown.Item onClick={onClick}>
      <span className="simple-icon-trash" />
      <span className="ms-2">Delete</span>
    </Dropdown.Item>
  );
}

type ChangeRelation = (relations: Relations, expand: boolean) => void;

function useOnChangeRelations(): undefined | ChangeRelation {
  const { knowledgeDBs, user } = useData();
  const { editorOpenViews, setEditorOpenState } = useTemporaryView();
  const viewPath = useViewPath();
  const { finalizeEvent } = useApis();
  const { createPlan, executePlan } = usePlanner();
  const view = useNode()[1];
  const viewKey = useViewKey();
  const deselectAllInView = useDeselectAllInView();
  if (!view) {
    return undefined;
  }

  return (relations: Relations, expand: boolean): void => {
    const viewKeyOfAddToNode = addAddToNodeToPath(
      knowledgeDBs,
      user.publicKey,
      viewPath
    );

    const { views } = knowledgeDBs.get(user.publicKey, newDB());
    const plan = planUpdateViews(
      createPlan(),
      updateView(views, viewPath, {
        ...view,
        relations: relations.id,
        expanded: expand,
      }),
      finalizeEvent
    );
    executePlan(plan);
    setEditorOpenState(
      closeEditor(editorOpenViews, viewPathToString(viewKeyOfAddToNode))
    );
    deselectAllInView(viewKey);
  };
}

function SelectOtherRelationsItem({
  relations,
}: {
  relations: Relations;
}): JSX.Element | null {
  const onChangeRelations = useOnChangeRelations();
  if (!onChangeRelations) {
    return null;
  }
  const remote = isRemote(splitID(relations.id)[0], useData().user.publicKey);
  return (
    <>
      <Dropdown.Item onClick={() => onChangeRelations(relations, true)}>
        <div>
          <span>{relations.items.size} Notes</span>
          <span>{remote && <span className="iconsminds-conference" />}</span>
        </div>
        <div>
          <span>{new Date(relations.updated * 1000).toLocaleDateString()}</span>
        </div>
      </Dropdown.Item>
      <Dropdown.Divider />
    </>
  );
}

function EditRelationsDropdown({
  className,
  style,
  otherRelations,
}: {
  className: string;
  style: CSSProperties;
  otherRelations: List<Relations>;
}): JSX.Element | null {
  const view = useNode()[1];
  const { user } = useData();
  if (!view || !view.relations) {
    return null;
  }

  const isDeleteAvailable =
    view.relations !== "social" &&
    !isRemote(splitID(view.relations)[0], user.publicKey);
  if (!isDeleteAvailable && otherRelations.size === 0) {
    return null;
  }

  return (
    <Dropdown>
      <Dropdown.Toggle
        as="button"
        className={className}
        style={{
          ...style,
          borderLeftWidth: "1px",
          borderLeftStyle: "solid",
          borderLeftColor: "white",
        }}
      >
        <span className="iconsminds-arrow-down" />
      </Dropdown.Toggle>
      <Dropdown.Menu popperConfig={{ strategy: "fixed" }} renderOnMount>
        {otherRelations.map((r) => (
          <SelectOtherRelationsItem key={r.id} relations={r} />
        ))}

        {isDeleteAvailable && <DeleteRelationItem id={view.relations} />}
      </Dropdown.Menu>
    </Dropdown>
  );
}

type ShowRelationsButtonProps = {
  relationList: List<Relations>;
  readonly?: boolean;
  alwaysOneSelected?: boolean;
  currentSelectedRelations?: Relations;
};

function useOnToggleExpanded(): (expand: boolean) => void {
  const { knowledgeDBs, user } = useData();
  const { finalizeEvent } = useApis();
  const { createPlan, executePlan } = usePlanner();
  const viewPath = useViewPath();
  const view = useNode()[1];
  const { editorOpenViews, setEditorOpenState } = useTemporaryView();
  if (!view) {
    return () => undefined;
  }
  return (expand: boolean): void => {
    const viewKeyOfAddToNode = viewPathToString(
      addAddToNodeToPath(knowledgeDBs, user.publicKey, viewPath)
    );
    const { views } = knowledgeDBs.get(user.publicKey, newDB());
    const plan = planUpdateViews(
      createPlan(),
      updateView(views, viewPath, {
        ...view,
        expanded: expand,
      }),
      finalizeEvent
    );
    executePlan(plan);
    if (!expand) {
      setEditorOpenState(closeEditor(editorOpenViews, viewKeyOfAddToNode));
    }
  };
}

function SocialRelationsButton({
  alwaysOneSelected,
  currentRelations,
  readonly,
}: {
  readonly?: boolean;
  alwaysOneSelected?: boolean;
  currentRelations?: Relations;
}): JSX.Element | null {
  const [node, view] = useNode();
  const { knowledgeDBs, user } = useData();
  const onChangeRelations = useOnChangeRelations();
  const onToggleExpanded = useOnToggleExpanded();
  if (!node || !onChangeRelations || !onToggleExpanded) {
    return null;
  }
  const socialRelations = getRelations(
    knowledgeDBs,
    "social",
    user.publicKey,
    node.id
  );
  if (!socialRelations || socialRelations.items.size === 0) {
    return null;
  }
  const isSelected = currentRelations?.id === "social";
  const isExpanded = view.expanded === true;
  const ariaLabel =
    isExpanded && isSelected
      ? `hide items created by contacts of ${node.text}`
      : `show items created by contacts of ${node.text}`;
  const isActive = (isExpanded || alwaysOneSelected) && isSelected;
  const className = `btn select-relation ${
    isActive ? "opacity-none" : "deselected"
  }`;
  const style = {
    backgroundColor: "black",
    borderTopColor: "black",
    borderRightColor: "black",
    borderBottomColor: "black",
    borderLeftColor: "black",
    color: "white",
  };
  const preventDeselect = isActive && alwaysOneSelected;
  const onClick = preventDeselect
    ? undefined
    : () => {
        if (view.relations === socialRelations.id) {
          onToggleExpanded(!isExpanded);
        } else {
          onChangeRelations(socialRelations, true);
        }
      };
  const label = isActive
    ? `By Contacts (${socialRelations.items.size})`
    : socialRelations.items.size;

  return (
    <div className="btn-group select-relation">
      <button
        type="button"
        aria-label={ariaLabel}
        className={className}
        disabled={preventDeselect || readonly}
        style={style}
        onClick={onClick}
      >
        <span className="iconsminds-conference" />
        <span>{label}</span>
      </button>
    </div>
  );
}

function sortRelations(
  relationList: List<Relations>,
  myself: PublicKey
): List<Relations> {
  return relationList.sort((rA, rB) => {
    // Sort by date, but the one relation which is not remote comes always first
    if (!isRemote(splitID(rA.id)[0], myself)) {
      return -1;
    }
    if (!isRemote(splitID(rB.id)[0], myself)) {
      return 1;
    }
    return rB.updated - rA.updated;
  });
}

function SelectRelationsButton({
  relationList,
  readonly: ro,
  alwaysOneSelected,
  currentSelectedRelations,
}: ShowRelationsButtonProps): JSX.Element | null {
  const [node, view] = useNode();
  const { knowledgeDBs, user } = useData();
  const readonly = ro === true;
  const onChangeRelations = useOnChangeRelations();
  const onToggleExpanded = useOnToggleExpanded();
  if (!node || !view || !onChangeRelations) {
    return null;
  }
  const isSelected =
    relationList.filter((r) => r.id === currentSelectedRelations?.id).size > 0;
  const sorted = sortRelations(relationList, user.publicKey);
  const topRelation = isSelected ? currentSelectedRelations : sorted.first();
  if (!topRelation) {
    return null;
  }
  const otherRelations = sorted.filter((r) => r.id !== topRelation.id);
  const [relationType] = getRelationTypeByRelationsID(
    knowledgeDBs,
    user.publicKey,
    topRelation.id
  );
  const relationSize = topRelation.items.size;

  if (readonly) {
    return (
      <div className="flex-start deselected">
        <span className="font-size-small pe-1">{relationSize}</span>
      </div>
    );
  }

  const isExpanded = view.expanded === true;
  const ariaLabel =
    isExpanded && isSelected
      ? `hide ${relationType?.label || "list"} items of ${node.text}`
      : `show ${relationType?.label || "list"} items of ${node.text}`;

  const isActive = (isExpanded || alwaysOneSelected) && isSelected;
  const className = `btn select-relation ${
    isActive ? "opacity-none" : "deselected"
  }`;
  const style = relationType
    ? {
        backgroundColor: relationType.color,
        borderTopColor: relationType.color,
        borderRightColor: relationType.color,
        borderBottomColor: relationType.color,
        borderLeftColor: relationType.color,
        color: "white",
      }
    : {};
  const label = isActive
    ? `${relationType?.label || "Unknown"} (${relationSize})`
    : relationSize;
  const preventDeselect = isActive && alwaysOneSelected;
  const onClick = preventDeselect
    ? undefined
    : () => {
        if (view.relations === topRelation.id) {
          onToggleExpanded(!isExpanded);
        } else {
          onChangeRelations(topRelation, true);
        }
      };
  return (
    <div className="btn-group select-relation">
      <button
        type="button"
        aria-label={ariaLabel}
        className={className}
        disabled={preventDeselect}
        style={style}
        onClick={onClick}
      >
        <span className="">{label}</span>
      </button>
      {isActive && (
        <EditRelationsDropdown
          className={className}
          style={style}
          otherRelations={otherRelations}
        />
      )}
    </div>
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
  const [node, view] = useNode();
  if (!node) {
    return null;
  }
  const currentRelations = getRelations(
    knowledgeDBs,
    view.relations,
    user.publicKey,
    node.id
  );
  const relations = getAvailableRelationsForNode(
    knowledgeDBs,
    user.publicKey,
    node.id
  );
  const groupedByType = relations.groupBy((r) => r.type);
  return (
    <>
      {groupedByType.toArray().map(([type, r]) => (
        <SelectRelationsButton
          relationList={r.toList()}
          readonly={readonly}
          alwaysOneSelected={alwaysOneSelected}
          currentSelectedRelations={currentRelations}
          key={type}
        />
      ))}
      <SocialRelationsButton
        readonly={readonly}
        alwaysOneSelected={alwaysOneSelected}
        currentRelations={currentRelations}
      />
      {!readonly && <AddRelationsButton />}
    </>
  );
}
