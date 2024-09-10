import React, { CSSProperties } from "react";
import { Dropdown } from "react-bootstrap";
import { List } from "immutable";
import { v4 } from "uuid";
import {
  addAddToNodeToPath,
  deleteChildViews,
  getAvailableRelationsForNode,
  getDefaultRelationForNode,
  updateView,
  useNode,
  useNodeID,
  useParentNode,
  useViewKey,
  useViewPath,
  viewPathToString,
} from "../ViewContext";
import {
  closeEditor,
  useDeselectAllInView,
  useTemporaryView,
} from "./TemporaryViewContext";
import {
  REFERENCED_BY,
  SOCIAL,
  getRelations,
  isRemote,
  splitID,
} from "../connections";
import { useData } from "../DataContext";
import {
  planDeleteRelations,
  planUpdateRelationTypes,
  planUpdateViews,
  usePlanner,
} from "../planner";
import {
  AddNewRelationsToNodeItem,
  NewRelationType,
  getRelationTypeByRelationsID,
  planAddNewRelationToNode,
  useGetAllRelationTypes,
} from "./RelationTypes";

function AddRelationsButton(): JSX.Element {
  const { relationTypes } = useData();
  const { createPlan, executePlan } = usePlanner();
  const [node, view] = useNode();
  const viewPath = useViewPath();
  const allRelationTypes = useGetAllRelationTypes();
  const ariaLabel = `Add new Relations to ${node?.text || ""}`;

  const onSubmit = (relationType: RelationType): void => {
    const id = v4();
    const updateRelationTypesPlan = planUpdateRelationTypes(
      createPlan(),
      relationTypes.set(id, relationType)
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
  };
  return (
    <Dropdown>
      <Dropdown.Toggle
        as="button"
        className="btn new-relation"
        aria-label={ariaLabel}
      >
        <span>+</span>
      </Dropdown.Toggle>
      <Dropdown.Menu popperConfig={{ strategy: "fixed" }} renderOnMount>
        <div className="dropdown-item-wide">
          <NewRelationType
            onAddRelationType={onSubmit}
            usedColors={relationTypes
              .toArray()
              .map(([, relType]) => relType.color)}
            className="m-1 ms-0"
          />
        </div>
        <Dropdown.Divider />
        {allRelationTypes
          .keySeq()
          .toArray()
          .map((id) => (
            <AddNewRelationsToNodeItem key={id} relationTypeID={id} />
          ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}

function DeleteRelationItem({ id }: { id: LongID }): JSX.Element | null {
  const { createPlan, executePlan } = usePlanner();
  const { user, views, relationTypes, contactsRelationTypes } = useData();
  const viewPath = useViewPath();
  const [nodeID, view] = useNodeID();

  const onClick = (): void => {
    const deleteRelationsPlan = planDeleteRelations(createPlan(), id);
    // TODO: deleteChildViews should only be necessary for the deleted relation not the other
    const plan = planUpdateViews(
      deleteRelationsPlan,
      updateView(deleteChildViews(views, viewPath), viewPath, {
        ...view,
        relations: getDefaultRelationForNode(
          nodeID,
          deleteRelationsPlan.knowledgeDBs,
          user.publicKey,
          relationTypes,
          contactsRelationTypes
        ),
      })
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

function useOnChangeRelations(): ChangeRelation {
  const data = useData();
  const { editorOpenViews, setEditorOpenState } = useTemporaryView();
  const viewPath = useViewPath();
  const { createPlan, executePlan } = usePlanner();
  const view = useNodeID()[1];
  const viewKey = useViewKey();
  const deselectAllInView = useDeselectAllInView();

  return (relations: Relations, expand: boolean): void => {
    const viewKeyOfAddToNode = addAddToNodeToPath(data, viewPath);
    const plan = planUpdateViews(
      createPlan(),
      updateView(data.views, viewPath, {
        ...view,
        relations: relations.id,
        expanded: expand,
      })
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
  const view = useNodeID()[1];
  const { user } = useData();
  if (!view.relations) {
    return null;
  }

  const isDeleteAvailable =
    view.relations !== SOCIAL &&
    view.relations !== REFERENCED_BY &&
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
        {otherRelations.size > 0 && isDeleteAvailable && <Dropdown.Divider />}

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
  const data = useData();
  const { createPlan, executePlan } = usePlanner();
  const viewPath = useViewPath();
  const view = useNodeID()[1];
  const { editorOpenViews, setEditorOpenState } = useTemporaryView();
  return (expand: boolean): void => {
    const viewKeyOfAddToNode = viewPathToString(
      addAddToNodeToPath(data, viewPath)
    );
    const plan = planUpdateViews(
      createPlan(),
      updateView(data.views, viewPath, {
        ...view,
        expanded: expand,
      })
    );
    executePlan(plan);
    if (!expand) {
      setEditorOpenState(closeEditor(editorOpenViews, viewKeyOfAddToNode));
    }
  };
}

function AutomaticRelationsButton({
  alwaysOneSelected,
  currentRelations,
  readonly,
  relations,
  hideShowLabel,
  children,
  label,
}: {
  hideShowLabel: string;
  relations: Relations;
  readonly?: boolean;
  alwaysOneSelected?: boolean;
  currentRelations?: Relations;
  children: React.ReactNode;
  label: string;
}): JSX.Element | null {
  const view = useNode()[1];
  const onChangeRelations = useOnChangeRelations();
  const onToggleExpanded = useOnToggleExpanded();
  if (!view || !onChangeRelations || !onToggleExpanded) {
    return null;
  }
  const isSelected = currentRelations?.id === relations.id;
  const isExpanded = view.expanded === true;
  const ariaLabel =
    isExpanded && isSelected
      ? `hide ${hideShowLabel}`
      : `show ${hideShowLabel}`;
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
        if (view.relations === relations.id) {
          onToggleExpanded(!isExpanded);
        } else {
          onChangeRelations(relations, true);
        }
      };
  const lbl = isActive ? label : relations.items.size;
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
        {children}
        <span>{lbl}</span>
      </button>
    </div>
  );
}

function ReferencedByRelationsButton({
  alwaysOneSelected,
  currentRelations,
  readonly,
}: {
  readonly?: boolean;
  alwaysOneSelected?: boolean;
  currentRelations?: Relations;
}): JSX.Element | null {
  const [node] = useNode();
  const [parentNode] = useParentNode();
  const { knowledgeDBs, user } = useData();
  if (!node) {
    return null;
  }
  const referencedByRelations = getRelations(
    knowledgeDBs,
    REFERENCED_BY,
    user.publicKey,
    node.id
  );
  if (!referencedByRelations) {
    return null;
  }
  // Don't show this button if the only reference is the parent
  const haveParent = parentNode !== undefined;
  const showBtn =
    (haveParent && referencedByRelations.items.size > 1) ||
    (!haveParent && referencedByRelations.items.size > 0);
  if (!showBtn) {
    return null;
  }
  return (
    <AutomaticRelationsButton
      hideShowLabel={`references to ${node.text}`}
      relations={referencedByRelations}
      readonly={readonly}
      alwaysOneSelected={alwaysOneSelected}
      currentRelations={currentRelations}
      label={`Referenced By (${referencedByRelations.items.size})`}
    >
      <span className="iconsminds-link" />
    </AutomaticRelationsButton>
  );
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
  const [node] = useNode();
  const { knowledgeDBs, user } = useData();
  const onChangeRelations = useOnChangeRelations();
  const onToggleExpanded = useOnToggleExpanded();
  if (!node || !onChangeRelations || !onToggleExpanded) {
    return null;
  }
  const socialRelations = getRelations(
    knowledgeDBs,
    SOCIAL,
    user.publicKey,
    node.id
  );
  if (!socialRelations || socialRelations.items.size === 0) {
    return null;
  }
  return (
    <AutomaticRelationsButton
      hideShowLabel={`items created by contacts of ${node.text}`}
      relations={socialRelations}
      readonly={readonly}
      alwaysOneSelected={alwaysOneSelected}
      currentRelations={currentRelations}
      label={`By Contacts (${socialRelations.items.size})`}
    >
      <span className="iconsminds-conference" />
    </AutomaticRelationsButton>
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

function relationLabel(
  isActive: boolean,
  relationType: RelationType | undefined,
  relationSize: number
): string {
  if (!isActive) {
    return `${relationSize}`;
  }
  if (!relationType) {
    return `Unknown (${relationSize})`;
  }
  if (relationType.label === "") {
    return `${relationSize}`;
  }
  return `${relationType.label} (${relationSize})`;
}

function SelectRelationsButton({
  relationList,
  readonly: ro,
  alwaysOneSelected,
  currentSelectedRelations,
}: ShowRelationsButtonProps): JSX.Element | null {
  const [node, view] = useNode();
  const data = useData();
  const readonly = ro === true;
  const onChangeRelations = useOnChangeRelations();
  const onToggleExpanded = useOnToggleExpanded();
  if (!node || !view || !onChangeRelations) {
    return null;
  }
  const isSelected =
    relationList.filter((r) => r.id === currentSelectedRelations?.id).size > 0;
  const sorted = sortRelations(relationList, data.user.publicKey);
  const topRelation = isSelected ? currentSelectedRelations : sorted.first();
  if (!topRelation) {
    return null;
  }
  const otherRelations = sorted.filter((r) => r.id !== topRelation.id);
  const [relationType] = getRelationTypeByRelationsID(data, topRelation.id);
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

  const isActive = (isExpanded || !!alwaysOneSelected) && isSelected;
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
  const label = relationLabel(isActive, relationType, relationSize);
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
  const { knowledgeDBs, user, relationTypes, contactsRelationTypes } =
    useData();
  const [nodeID, view] = useNodeID();
  const currentRelations = getRelations(
    knowledgeDBs,
    view.relations,
    user.publicKey,
    nodeID
  );
  const relations = getAvailableRelationsForNode(
    knowledgeDBs,
    user.publicKey,
    nodeID,
    relationTypes,
    contactsRelationTypes
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
      <ReferencedByRelationsButton
        readonly={readonly}
        alwaysOneSelected={alwaysOneSelected}
        currentRelations={currentRelations}
      />
      {!readonly && <AddRelationsButton />}
    </>
  );
}
