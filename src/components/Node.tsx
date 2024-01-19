import { List } from "immutable";
import React, { useContext, useEffect } from "react";
import { Draggable } from "react-beautiful-dnd";
import { useMediaQuery } from "react-responsive";
import { Link, matchPath, useLocation, useParams } from "react-router-dom";
import ReactQuill from "react-quill";
import { textVide } from "text-vide";
import DOMPurify from "dompurify";
import { FULL_SCREEN_PATH } from "../App";
import { DragUpdateStateContext, getDropDestinationFromTreeView } from "../dnd";
import { getRelations } from "../connections";
import { DEFAULT_BRANCH_NAME, getNode } from "../knowledge";
import {
  useGetNodeText,
  useKnowledgeData,
  useUpdateKnowledge,
} from "../KnowledgeDataContext";
import {
  getNodeFromView,
  getParentKey,
  popPrefix,
  updateView,
  useNode,
  useViewKey,
  useViewPath,
  ViewPath,
  parseViewPath,
  updateNode,
  useParentRepo,
  useIsAddToNode,
} from "../ViewContext";
import {
  useGetSelectedInView,
  useIsSelected,
  NodeSelectbox,
  toggleEditing,
  useTemporaryView,
  useIsEditingOn,
  useIsParentMultiselectBtnOn,
} from "./TemporaryViewContext";
import { IS_MOBILE } from "./responsive";
import { AddNodeToNode } from "./AddNode";
import { NodeMenu } from "./Menu";
import { NodeCard, CloseButton, Button } from "./Ui";
import { DeleteNode } from "./DeleteNode";
import { useData } from "../DataContext";

function createSearchParams(branch?: BranchPath): string {
  if (!branch) {
    return "";
  }
  const [origin, name] = branch;
  if (origin && name) {
    return `?origin=${origin}&branch=${name}`;
  }
  if (!origin && name && name !== DEFAULT_BRANCH_NAME) {
    return `?branch=${name}`;
  }
  return "";
}

export function getLevels(
  viewPath: ViewPath,
  isOpenInFullScreen: boolean
): number {
  if (isOpenInFullScreen) {
    return viewPath.indexStack.size;
  }
  return viewPath.indexStack.size - 1;
}

export function useIsOpenInFullScreen(): boolean {
  const location = useLocation();
  const { openNodeID: id } = useParams<{
    openNodeID: string;
  }>();
  const viewPath = useViewPath();
  if (matchPath(FULL_SCREEN_PATH, location.pathname) === null) {
    return false;
  }
  return !!(id !== undefined && id === viewPath.root);
}

function ErrorContent(): JSX.Element {
  return (
    <div>
      <b>Error: Node not found</b>
      <p>The node you requested could not be found. Possible reasons are:</p>
      <ul>
        <li>You do not have permission to see this node.</li>
        <li>The node has been deleted.</li>
      </ul>
      <p>Please check your permissions and try again.</p>
    </div>
  );
}

type InlineEditorProps = {
  onCreateNode: (text: string) => void;
  onStopEditing: () => void;
};

function InlineEditor({
  onCreateNode,
  onStopEditing,
}: InlineEditorProps): JSX.Element {
  const [repo, view] = useNode();
  const getNodeText = useGetNodeText();
  const ref = React.createRef<ReactQuill>();
  if (!repo) {
    return <ErrorContent />;
  }
  const nodeText = getNodeText(getNode(repo, view.branch));
  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      ref.current.getEditor().deleteText(0, 1000000);
      ref.current.getEditor().insertText(0, nodeText);
    }
  }, []);
  const onSave = (): void => {
    if (!ref.current) {
      return;
    }
    onCreateNode(ref.current.getEditor().getText());
  };
  return (
    <>
      <div className="editor">
        <div className="scrolling-container flex-row-start w-100">
          <ReactQuill
            theme="bubble"
            formats={[]}
            modules={{ toolbar: false }}
            scrollingContainer="scrolling-container"
            ref={ref}
          />
        </div>
      </div>
      <div className="flex-row-space-between">
        <DeleteNode afterOnClick={onStopEditing} />
        <div className="flex-row-end">
          <Button
            className="btn font-size-small"
            onClick={onSave}
            ariaLabel="save"
          >
            <span>Save</span>
          </Button>
          <CloseButton onClose={onStopEditing} />
        </div>
      </div>
    </>
  );
}

function useDisplaySummary(): {
  displaySummary: boolean;
  summaryToDisplay: Repo | undefined;
} {
  const { repos } = useKnowledgeData();
  const levels = getLevels(useViewPath(), useIsOpenInFullScreen());
  const [repo, view] = useNode();
  if (!repo) {
    return {
      displaySummary: false,
      summaryToDisplay: undefined,
    };
  }
  const node = getNode(repo, view.branch);
  const summaryRelations = getRelations(node, "SUMMARY");
  const summaryId = summaryRelations.first()?.id || undefined;
  const summaryExists = summaryId !== undefined;
  const summaryNotShownInTreeView =
    view.relationType !== "SUMMARY" || !view?.expanded;
  const summaryToDisplay =
    summaryExists && summaryNotShownInTreeView && levels >= 1
      ? repos.get(summaryId)
      : undefined;
  const displaySummary = summaryToDisplay !== undefined;
  return {
    displaySummary,
    summaryToDisplay,
  };
}

function BionicText({ nodeText }: { nodeText: string }): JSX.Element {
  // need sanitizing, i.e. removing <script>-tags or onClick handles
  // otherwise dangerouslySetInnerHTML allows Cross-Site Scripting (XSS) attacks
  const sanitizedNodeText = `<span>${DOMPurify.sanitize(nodeText)}</span>`;
  const bionicNodeText = textVide(sanitizedNodeText, {
    sep: ["<b>", "</b>"],
    fixationPoint: 4,
  });
  // eslint-disable-next-line react/no-danger
  return <div dangerouslySetInnerHTML={{ __html: bionicNodeText }} />;
}

function NodeContent(): JSX.Element {
  const getNodeText = useGetNodeText();
  const { settings } = useData();
  const [repo, view] = useNode();
  if (!repo) {
    return <ErrorContent />;
  }
  const node = getNode(repo, view.branch);
  const { displaySummary, summaryToDisplay } = useDisplaySummary();
  const nodeToDisplay =
    summaryToDisplay !== undefined ? getNode(summaryToDisplay) : node;
  const isBionic = node.nodeType === "QUOTE" && settings.bionicReading;
  return (
    <div>
      <span className={displaySummary ? "iconsminds-filter-2 me-2" : ""} />
      <span
        className={displaySummary ? "font-italic break-word" : "break-word"}
      >
        {isBionic ? (
          <BionicText nodeText={getNodeText(nodeToDisplay)} />
        ) : (
          getNodeText(nodeToDisplay)
        )}
      </span>
    </div>
  );
}

function NodeAutoLink({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element | null {
  const { openNodeID: id } = useParams<{
    openNodeID: string;
  }>();
  const [repo, view] = useNode();
  if (!repo) {
    return <ErrorContent />;
  }
  const isMainNodeInFullscreenView = id !== undefined && id === repo.id;
  const node = getNode(repo, view.branch);
  return isMainNodeInFullscreenView ? (
    <>{children}</>
  ) : (
    <Link
      className="no-underline"
      to={
        node.nodeType === "WORKSPACE"
          ? `/w/${repo.id}`
          : `/d/${repo.id}${createSearchParams(view.branch)}`
      }
    >
      {children}
    </Link>
  );
}

function EditingNodeContent(): JSX.Element {
  const { repos, views } = useKnowledgeData();
  const updateKnowledge = useUpdateKnowledge();
  const viewContext = useViewPath();
  const viewKey = useViewKey();
  const { editingViews, setEditingState } = useTemporaryView();
  const editNodeText = (text: string): void => {
    updateKnowledge(
      updateNode(repos, views, viewContext, (n) => {
        return {
          ...n,
          text,
        };
      })
    );
  };
  const closeEditor = (): void => {
    setEditingState(toggleEditing(editingViews, viewKey));
  };
  return (
    <InlineEditor
      onCreateNode={(text) => {
        editNodeText(text);
        closeEditor();
      }}
      onStopEditing={closeEditor}
    />
  );
}

const INDENTATION = 10;
const ARROW_WIDTH = 6;

function Indent({ levels }: { levels: number }): JSX.Element {
  return (
    <>
      {Array.from(Array(levels).keys()).map((k) => {
        return (
          <div key={k} style={{ marginLeft: ARROW_WIDTH }}>
            <div style={{ width: INDENTATION }} />
            {k !== 0 && (
              <div>
                <div className="vl" />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function getNodesInTree(
  repos: Repos,
  views: Views,
  parentPath: ViewPath,
  ctx: List<ViewPath>,
  isOpenInFullScreen?: boolean,
  noExpansion?: boolean
): List<ViewPath> {
  const [parentRepo, parentView] = getNodeFromView(repos, views, parentPath);
  if (!parentRepo) {
    return ctx;
  }
  const parentNode = getNode(parentRepo, parentView.branch);
  const childPaths = getRelations(parentNode, parentView.relationType).map(
    (rel, i) => ({
      ...parentPath,
      indexStack: parentPath.indexStack.push(i),
    })
  );
  const addNodePath = {
    ...parentPath,
    indexStack: parentPath.indexStack.push(childPaths.size),
  };
  const nodesInTree = childPaths.reduce(
    (nodesList: List<ViewPath>, childPath: ViewPath) => {
      const [childRepo, childView] = getNodeFromView(repos, views, childPath);
      if (!childRepo || noExpansion) {
        return nodesList.push(childPath);
      }
      if (childView.expanded) {
        return getNodesInTree(
          repos,
          views,
          childPath,
          nodesList.push(childPath),
          isOpenInFullScreen
        );
      }
      return nodesList.push(childPath);
    },
    ctx
  );
  return getLevels(parentPath, isOpenInFullScreen || false) === 0
    ? nodesInTree
    : nodesInTree.push(addNodePath);
}

function DraggingNode(): JSX.Element {
  const viewKey = useViewKey();
  const findSelected = useGetSelectedInView();
  const parentViewKey = getParentKey(viewKey);
  const checked = useIsSelected();
  const badgeCounter = checked ? findSelected(parentViewKey).size : undefined;
  const dragUpdateState = useContext(DragUpdateStateContext);
  const viewPath = useViewPath();
  const { repos, views } = useKnowledgeData();
  const view = getNodeFromView(repos, views, viewPath)[1];
  const isOpenInFullScreen = useIsOpenInFullScreen();

  const dropDestination =
    dragUpdateState &&
    dragUpdateState.initial &&
    dragUpdateState.initial.destination &&
    dragUpdateState.initial.destination;

  const viewsWithCollapsedSource = view
    ? updateView(views, viewPath, {
        ...view,
        expanded: false,
      })
    : undefined;

  const levels =
    dropDestination && viewsWithCollapsedSource
      ? getDropDestinationFromTreeView(
          repos,
          viewsWithCollapsedSource,
          parseViewPath(popPrefix(dropDestination.droppableId)[1]),
          dropDestination.index
          // this will be the new parent, therefore no -1
        )[0].indexStack.size
      : getLevels(viewPath, isOpenInFullScreen);

  return (
    <NodeCard badgeValue={badgeCounter}>
      {levels > 0 && <Indent levels={levels} />}
      <NodeContent />
    </NodeCard>
  );
}

function Ribbon(): JSX.Element | null {
  const repo = useNode()[0];
  const nodeType = repo !== undefined ? getNode(repo).nodeType : undefined;
  if (!nodeType) {
    return null;
  }
  return <div className={`ribbon-${nodeType}`} />;
}

export function Node(): JSX.Element | null {
  const isMobile = useMediaQuery(IS_MOBILE);
  const viewPath = useViewPath();
  const isOpenInFullScreen = useIsOpenInFullScreen();
  const levels = getLevels(viewPath, isOpenInFullScreen);
  const isAddToNode = useIsAddToNode();
  const [parentRepo, parentView] = useParentRepo();
  const isNodeBeingEdited = useIsEditingOn();
  const isMultiselect = useIsParentMultiselectBtnOn();
  const parentNode =
    parentRepo !== undefined
      ? getNode(parentRepo, parentView.branch)
      : undefined;
  const nRelations =
    parentNode &&
    parentView &&
    getRelations(parentNode, parentView.relationType).size;
  const index = viewPath.indexStack.last();
  const isReferencedNode =
    index !== undefined && nRelations !== undefined && index >= nRelations;
  const displayMenu = levels > 0 && !isReferencedNode;

  return (
    <NodeCard
      className={!isMobile ? "hover-light-bg" : undefined}
      cardBodyClassName={
        !isMobile && isOpenInFullScreen ? "ps-2 pt-2 pb-2" : undefined
      }
    >
      {!isAddToNode && <Ribbon />}
      {levels > 0 && <Indent levels={levels} />}
      {isAddToNode && levels !== 1 && <AddNodeToNode />}
      {!isAddToNode && (
        <>
          {isMultiselect && <NodeSelectbox />}
          <div className="flex-column w-100">
            {isNodeBeingEdited && <EditingNodeContent />}
            {!isNodeBeingEdited && (
              <NodeAutoLink>
                <NodeContent />
              </NodeAutoLink>
            )}
            {displayMenu && <NodeMenu />}
          </div>
        </>
      )}
    </NodeCard>
  );
}

/* eslint-disable react/jsx-props-no-spreading */
export function DraggableNode({
  dndIndex,
  sticky,
}: {
  dndIndex: number;
  sticky?: boolean;
}): JSX.Element | null {
  const viewKey = useViewKey();
  const parentViewKey = getParentKey(viewKey);
  const isMobile = useMediaQuery(IS_MOBILE);
  return (
    <Draggable draggableId={viewKey} index={dndIndex} isDragDisabled={isMobile}>
      {(providedDraggable, snapshot) => {
        return (
          <>
            <div
              id={viewKey}
              ref={providedDraggable.innerRef}
              {...providedDraggable.draggableProps}
              {...providedDraggable.dragHandleProps}
              style={providedDraggable.draggableProps.style}
            >
              {snapshot.isDragging && <DraggingNode />}
              {!snapshot.isDragging && <Node />}
            </div>
            {snapshot.isDragging &&
              (sticky ||
                (snapshot.draggingOver &&
                  popPrefix(snapshot.draggingOver)[1] !== parentViewKey)) && (
                <Node />
              )}
          </>
        );
      }}
    </Draggable>
  );
}
