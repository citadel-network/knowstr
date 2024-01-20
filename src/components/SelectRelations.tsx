import React from "react";
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

type ShowRelationsButtonProps = {
  id: LongID;
  readonly?: boolean;
};

enum AriaLabelsForTypes {
  "RELEVANCE" = "relevant relations",
  "CONTAINS" = "contained nodes",
  "SUMMARYG" = "summaries",
}

enum IconLabelsForTypes {
  "RELEVANCE" = "iconsminds-link",
  "CONTAINS" = "iconsminds-inbox-full",
  "SUMMARY" = "iconsminds-filter-2",
}

function ShowRelationsButton({
  id,
  readonly: ro,
}: ShowRelationsButtonProps): JSX.Element {
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
  const relations = getRelations(knowledgeDBs, id, user.publicKey);
  const relationSize = relations ? relations.items.size : 0;
  const isFirstLevelAddToNode = getLevels(viewPath, isFullScreen) === 0;
  const viewKeyOfAddToNode = isFirstLevelAddToNode
    ? viewKey
    : viewPathToString({
        ...viewPath,
        indexStack: viewPath.indexStack.push(relationSize),
      });

  // Removed this one
  // <span className={`${IconLabelsForTypes[type]}`} />
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

  const isSelected = isExpanded && view.relations === relations?.id;
  const className = `btn btn-borderless ${isSelected ? "" : "deselected"}`;
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
  // <span className={`${IconLabelsForTypes[id]}`} />
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={className}
      onClick={() => {
        if (view.relations === id) {
          onToggleExpanded(!isExpanded);
        } else {
          onChangeRelations(id, true);
        }
      }}
    >
      <div className="flex-start">
        <span className="font-size-small pe-1">{relationSize}</span>
      </div>
    </button>
  );
}

export function SelectRelations({
  readonly,
}: {
  readonly?: boolean;
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
        />
      ))}
    </>
  );
  /*
  return (
    <>
      <ShowRelationsButton id="RELEVANCE" readonly={readonly} />
      <ShowRelationsButton id="CONTAINS" readonly={readonly} />
      <ShowRelationsButton id="SUMMARYGNATZ" readonly={readonly} />
    </>
  );
       */
}
