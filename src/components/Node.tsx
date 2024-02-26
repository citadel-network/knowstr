import { List } from "immutable";
import React, { useContext, useEffect } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { useMediaQuery } from "react-responsive";
import { Link, matchPath, useLocation, useParams } from "react-router-dom";
import ReactQuill from "react-quill";
import { textVide } from "text-vide";
import DOMPurify from "dompurify";
import { FULL_SCREEN_PATH } from "../App";
import { DragUpdateStateContext, getDropDestinationFromTreeView } from "../dnd";
import { getRelations } from "../connections";
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
  useIsAddToNode,
  getRoot,
  addNodeToPath,
  addAddToNodeToPath,
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
import { useInputElementFocus } from "../FocusContextProvider";
import { IS_MOBILE } from "./responsive";
import { AddNodeToNode } from "./AddNode";
import { NodeMenu } from "./Menu";
import { NodeCard, CloseButton, Button } from "./Ui";
import { DeleteNode } from "./DeleteNode";
import { useData } from "../DataContext";
import { newDB } from "../knowledge";
import { planUpsertNode, usePlanner } from "../planner";
import { ReactQuillWrapper } from "./ReactQuillWrapper";
import { useApis } from "../Apis";

function getLevels(viewPath: ViewPath, isOpenInFullScreen: boolean): number {
  if (isOpenInFullScreen) {
    return viewPath.length - 1;
  }
  return viewPath.length - 2;
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
  return !!(id !== undefined && id === getRoot(viewPath).nodeID);
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
  const [node] = useNode();
  const ref = React.createRef<ReactQuill>();
  if (!node) {
    return <ErrorContent />;
  }
  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      ref.current.getEditor().deleteText(0, 1000000);
      ref.current.getEditor().insertText(0, node.text);
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
          <ReactQuillWrapper ref={ref} />
        </div>
      </div>
      <div className="flex-row-space-between">
        <DeleteNode
          afterOnClick={() => {
            onStopEditing();
          }}
        />
        <div className="flex-row-end">
          <Button
            className="btn font-size-small"
            onClick={onSave}
            ariaLabel="save"
          >
            <span>Save</span>
          </Button>
          <CloseButton
            onClose={() => {
              onStopEditing();
            }}
          />
        </div>
      </div>
    </>
  );
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
  const { settings } = useData();
  const [node] = useNode();
  if (!node) {
    return <ErrorContent />;
  }
  const isBionic = settings.bionicReading;
  return (
    <div>
      <span className="break-word">
        {isBionic ? <BionicText nodeText={node.text} /> : node.text}
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
  const [node] = useNode();
  if (!node) {
    return <ErrorContent />;
  }
  const isMainNodeInFullscreenView = id !== undefined && id === node.id;
  return isMainNodeInFullscreenView ? (
    <>{children}</>
  ) : (
    <Link className="no-underline" to={`/d/${node.id}`}>
      {children}
    </Link>
  );
}

function EditingNodeContent(): JSX.Element | null {
  const [node] = useNode();
  const { finalizeEvent } = useApis();
  const { createPlan, executePlan } = usePlanner();
  const viewKey = useViewKey();
  const { editingViews, setEditingState } = useTemporaryView();
  const { setIsInputElementInFocus } = useInputElementFocus();
  if (!node) {
    return null;
  }
  const editNodeText = (text: string): void => {
    executePlan(
      planUpsertNode(
        createPlan(),
        {
          ...node,
          text,
        },
        finalizeEvent
      )
    );
  };
  const closeEditor = (): void => {
    setIsInputElementInFocus(false);
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

export function Indent({ levels }: { levels: number }): JSX.Element {
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
  knowledgeDBs: KnowledgeDBs,
  myself: PublicKey,
  parentPath: ViewPath,
  ctx: List<ViewPath>,
  isOpenInFullScreen?: boolean,
  noExpansion?: boolean
): List<ViewPath> {
  const { views } = knowledgeDBs.get(myself, newDB());
  const [parentNode, parentView] = getNodeFromView(
    knowledgeDBs,
    views,
    myself,
    parentPath
  );
  if (!parentNode) {
    return ctx;
  }
  const relations = getRelations(
    knowledgeDBs,
    parentView.relations,
    myself,
    parentNode.id
  );
  if (!relations) {
    return ctx;
  }
  const childPaths = relations.items.map((_, i) =>
    addNodeToPath(knowledgeDBs, myself, parentPath, i)
  );
  const addNodePath = addAddToNodeToPath(knowledgeDBs, myself, parentPath);
  const nodesInTree = childPaths.reduce(
    (nodesList: List<ViewPath>, childPath: ViewPath) => {
      const [childRepo, childView] = getNodeFromView(
        knowledgeDBs,
        views,
        myself,
        childPath
      );
      if (!childRepo || noExpansion) {
        return nodesList.push(childPath);
      }
      if (childView.expanded) {
        return getNodesInTree(
          knowledgeDBs,
          myself,
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
  const { knowledgeDBs, user } = useData();
  const { views } = knowledgeDBs.get(user.publicKey, newDB());
  const view = getNodeFromView(
    knowledgeDBs,
    views,
    user.publicKey,
    viewPath
  )[1];
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
          knowledgeDBs,
          user.publicKey,
          viewsWithCollapsedSource,
          parseViewPath(popPrefix(dropDestination.droppableId)[1]),
          dropDestination.index
          // this will be the new parent, therefore no -1
        )[0].length - 1
      : getLevels(viewPath, isOpenInFullScreen);

  return (
    <NodeCard badgeValue={badgeCounter}>
      {levels > 0 && <Indent levels={levels} />}
      <NodeContent />
    </NodeCard>
  );
}

export function Node(): JSX.Element | null {
  const isMobile = useMediaQuery(IS_MOBILE);
  const viewPath = useViewPath();
  const isOpenInFullScreen = useIsOpenInFullScreen();
  const levels = getLevels(viewPath, isOpenInFullScreen);
  const isAddToNode = useIsAddToNode();
  const isNodeBeingEdited = useIsEditingOn();
  const isMultiselect = useIsParentMultiselectBtnOn();
  const displayMenu = levels > 0;
  return (
    <NodeCard
      className={!isMobile ? "hover-light-bg" : undefined}
      cardBodyClassName={
        !isMobile && isOpenInFullScreen ? "ps-2 pt-2 pb-2" : undefined
      }
    >
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
