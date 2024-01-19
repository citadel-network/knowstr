import React from "react";
import {
  useGetNodeText,
  useKnowledgeData,
  useUpdateKnowledge,
} from "../KnowledgeDataContext";
import {
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
import { getNode } from "../knowledge";
import { getRelations } from "../connections";
import { getLevels, useIsOpenInFullScreen } from "./Node";

type ShowRelationsButtonProps = {
  type: RelationType;
  readonly?: boolean;
};

enum AriaLabelsForTypes {
  "RELEVANCE" = "relevant relations",
  "CONTAINS" = "contained nodes",
  "SUMMARY" = "summaries",
}

enum IconLabelsForTypes {
  "RELEVANCE" = "iconsminds-link",
  "CONTAINS" = "iconsminds-inbox-full",
  "SUMMARY" = "iconsminds-filter-2",
}

function ShowRelationsButton({
  type,
  readonly: ro,
}: ShowRelationsButtonProps): JSX.Element {
  const [repo, view] = useNode();
  const readonly = ro === true;
  const { views } = useKnowledgeData();
  const getNodeText = useGetNodeText();
  const updateKnowledge = useUpdateKnowledge();
  const viewPath = useViewPath();
  const viewKey = useViewKey();
  const { editorOpenViews, setEditorOpenState } = useTemporaryView();
  const isFullScreen = useIsOpenInFullScreen();
  const deselectAllInView = useDeselectAllInView();
  if (!repo || !view) {
    return <></>;
  }
  const node = getNode(repo, view.branch);
  const nodeType = repo && getNode(repo).nodeType;
  const relationSize = getRelations(node, type).size;
  const isFirstLevelAddToNode = getLevels(viewPath, isFullScreen) === 0;
  const viewKeyOfAddToNode = isFirstLevelAddToNode
    ? viewKey
    : viewPathToString({
        ...viewPath,
        indexStack: viewPath.indexStack.push(relationSize),
      });
  const showSummaryRelationIcon = nodeType === "NOTE" || nodeType === "QUOTE";
  if (type === "SUMMARY" && !showSummaryRelationIcon) {
    return <></>;
  }

  if (readonly) {
    return (
      <div className="flex-start deselected">
        <span className={`${IconLabelsForTypes[type]}`} />
        <span className="font-size-small pe-1">{relationSize}</span>
      </div>
    );
  }

  const isExpanded = view.expanded === true;
  const nodeText = getNodeText(node);
  const ariaLabel =
    isExpanded && view.relationType === type
      ? `hide ${AriaLabelsForTypes[type]} of ${nodeText}`
      : `show ${AriaLabelsForTypes[type]} of ${nodeText}`;

  const isSelected = isExpanded && view.relationType === type;
  const className = `btn btn-borderless ${isSelected ? "" : "deselected"}`;
  const onChangeRelationType = (
    newRelationType: RelationType,
    expand: boolean
  ): void => {
    updateKnowledge({
      views: updateView(views, viewPath, {
        ...view,
        relationType: newRelationType,
        expanded: expand,
      }),
    });
    setEditorOpenState(closeEditor(editorOpenViews, viewKeyOfAddToNode));
    deselectAllInView(viewKey);
  };
  const onToggleExpanded = (expand: boolean): void => {
    updateKnowledge({
      views: updateView(views, viewPath, {
        ...view,
        expanded: expand,
      }),
    });
    if (!expand) {
      setEditorOpenState(closeEditor(editorOpenViews, viewKeyOfAddToNode));
    }
  };
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={className}
      onClick={() => {
        if (view.relationType === type) {
          onToggleExpanded(!isExpanded);
        } else {
          onChangeRelationType(type, true);
        }
      }}
    >
      <div className="flex-start">
        <span className={`${IconLabelsForTypes[type]}`} />
        <span className="font-size-small pe-1">{relationSize}</span>
      </div>
    </button>
  );
}

export function SelectRelations({
  readonly,
}: {
  readonly?: boolean;
}): JSX.Element {
  return (
    <>
      <ShowRelationsButton type="RELEVANCE" readonly={readonly} />
      <ShowRelationsButton type="CONTAINS" readonly={readonly} />
      <ShowRelationsButton type="SUMMARY" readonly={readonly} />
    </>
  );
}
