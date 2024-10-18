import { List } from "immutable";
import React, { useEffect } from "react";
import { useMediaQuery } from "react-responsive";
import { Link, matchPath, useLocation, useParams } from "react-router-dom";
import ReactQuill from "react-quill";
import { textVide } from "text-vide";
import DOMPurify from "dompurify";
import {
  useInputElementFocus,
  NodeCard,
  CloseButton,
  Button,
} from "citadel-commons";
import { FULL_SCREEN_PATH } from "../App";
import { getRelations } from "../connections";
import {
  useNode,
  useViewKey,
  useViewPath,
  ViewPath,
  useIsAddToNode,
  getRoot,
  addNodeToPath,
  addAddToNodeToPath,
  getNodeIDFromView,
  useNodeID,
  useParentNode,
} from "../ViewContext";
import {
  NodeSelectbox,
  toggleEditing,
  useTemporaryView,
  useIsEditingOn,
  useIsParentMultiselectBtnOn,
  isMutableNode,
} from "./TemporaryViewContext";
import { IS_MOBILE } from "./responsive";
import { AddNodeToNode } from "./AddNode";
import { NodeMenu } from "./Menu";
import { DeleteNode } from "./DeleteNode";
import { useData } from "../DataContext";
import { planUpsertNode, usePlanner } from "../planner";
import { ReactQuillWrapper } from "./ReactQuillWrapper";
import { useNodeIsLoading } from "../LoadingStatus";
import { NodeIcon } from "./NodeIcon";
import { getRelationTypeByRelationsID } from "./RelationTypes";

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

export function LoadingNode(): JSX.Element {
  return (
    <div className="ph-item">
      <div>
        <div className="ph-row">
          <div className="ph-col-12" />
          <div className="ph-col-8" />
          <div className="ph-col-12 " />
          <div className="ph-col-4" />
        </div>
      </div>
    </div>
  );
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
      const quill = ref.current.getEditor();
      quill.deleteText(0, 1000000);
      quill.insertText(0, node.text);
    }
  }, []);
  const onSave = (): void => {
    if (!ref.current) {
      return;
    }
    const text = ref.current.getEditor().getText();
    const isNewLineAdded = text.endsWith("\n");
    onCreateNode(isNewLineAdded ? text.slice(0, -1) : text);
  };
  return (
    <>
      <div className="editor pb-2">
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

function EditableNodeContent({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const { editingViews, setEditingState } = useTemporaryView();
  const viewKey = useViewKey();
  const handleInteraction = (
    event:
      | React.KeyboardEvent<HTMLButtonElement>
      | React.MouseEvent<HTMLButtonElement>
  ): void => {
    if (
      (event instanceof KeyboardEvent && event.key === "Enter") ||
      event.type === "click"
    ) {
      setEditingState(toggleEditing(editingViews, viewKey));
    }
  };

  return (
    <button
      type="button"
      onClick={handleInteraction}
      onKeyDown={handleInteraction}
      className="node-content-button cursor-on-hover w-100"
    >
      {children}
    </button>
  );
}

function NodeContent({ node }: { node: KnowNode }): JSX.Element {
  const { settings } = useData();
  const isBionic = settings.bionicReading;
  return (
    <span className="break-word">
      <NodeIcon node={node} />
      {isBionic ? <BionicText nodeText={node.text} /> : node.text}
    </span>
  );
}

function InteractiveNodeContent({
  editOnClick,
}: {
  editOnClick?: boolean;
}): JSX.Element {
  const { user } = useData();
  const [node] = useNode();
  const isLoading = useNodeIsLoading();
  if (isLoading) {
    return <LoadingNode />;
  }
  if (!node) {
    return <ErrorContent />;
  }
  if (editOnClick && isMutableNode(node, user)) {
    <EditableNodeContent>
      <NodeContent node={node} />
    </EditableNodeContent>;
  }
  return <NodeContent node={node} />;
}

function NodeAutoLink({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element | null {
  const { openNodeID: id } = useParams<{
    openNodeID: string;
  }>();
  const [nodeID] = useNodeID();
  const isMainNodeInFullscreenView = id !== undefined && id === nodeID;
  return isMainNodeInFullscreenView ? (
    <>{children}</>
  ) : (
    <Link className="no-underline" to={`/d/${escape(nodeID)}`}>
      {children}
    </Link>
  );
}

function EditingNodeContent(): JSX.Element | null {
  const [node] = useNode();
  const { createPlan, executePlan } = usePlanner();
  const viewKey = useViewKey();
  const { editingViews, setEditingState } = useTemporaryView();
  const { setIsInputElementInFocus } = useInputElementFocus();
  if (!node) {
    return null;
  }
  const editNodeText = (text: string): void => {
    executePlan(
      planUpsertNode(createPlan(), {
        ...node,
        text,
      })
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
const ARROW_WIDTH = 0;

export function Indent({ levels }: { levels: number }): JSX.Element {
  const parentView = useParentNode()[1];
  const data = useData();
  const [relationType] = parentView?.relations
    ? getRelationTypeByRelationsID(data, parentView.relations)
    : [undefined];
  const color = relationType?.color || undefined;
  const style = color
    ? {
        borderLeft: `2px solid ${color}`,
      }
    : {};
  return (
    <>
      {Array.from(Array(levels).keys()).map((k) => {
        return (
          <div key={k} style={{ marginLeft: ARROW_WIDTH }}>
            <div style={{ width: INDENTATION }} />
            {k !== 0 && (
              <div>
                <div className="vl" style={style} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function getNodesInTree(
  data: Data,
  parentPath: ViewPath,
  ctx: List<ViewPath>,
  isOpenInFullScreen?: boolean,
  noExpansion?: boolean
): List<ViewPath> {
  const [parentNodeID, parentView] = getNodeIDFromView(data, parentPath);
  const relations = getRelations(
    data.knowledgeDBs,
    parentView.relations,
    data.user.publicKey,
    parentNodeID
  );
  if (!relations) {
    return ctx;
  }
  const childPaths = relations.items.map((_, i) =>
    addNodeToPath(data, parentPath, i)
  );
  const addNodePath = addAddToNodeToPath(data, parentPath);
  const nodesInTree = childPaths.reduce(
    (nodesList: List<ViewPath>, childPath: ViewPath) => {
      const childView = getNodeIDFromView(data, childPath)[1];
      if (noExpansion) {
        return nodesList.push(childPath);
      }
      if (childView.expanded) {
        return getNodesInTree(
          data,
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

export function Node({
  className,
}: {
  className?: string;
}): JSX.Element | null {
  const isMobile = useMediaQuery(IS_MOBILE);
  const viewPath = useViewPath();
  const isOpenInFullScreen = useIsOpenInFullScreen();
  const isDesktopFullScreen = !isMobile && isOpenInFullScreen;
  const levels = getLevels(viewPath, isOpenInFullScreen);
  const isDesktopFullScreenTitleNode = isDesktopFullScreen && levels === 0;
  const isAddToNode = useIsAddToNode();
  const isNodeBeingEdited = useIsEditingOn();
  const isMultiselect = useIsParentMultiselectBtnOn();
  const displayMenu = levels > 0;
  const cls = !isMobile ? `${className || ""} hover-light-bg` : className;

  return (
    <NodeCard
      className={cls}
      cardBodyClassName={
        isDesktopFullScreen ? "ps-2 pt-2 pb-0" : `ps-0 pt-4 pb-0`
      }
    >
      {levels > 0 && <Indent levels={levels} />}
      {isAddToNode && levels !== 1 && <AddNodeToNode />}
      {!isAddToNode && (
        <>
          {isMultiselect && <NodeSelectbox />}
          <div className="flex-column w-100">
            {isNodeBeingEdited && <EditingNodeContent />}
            {!isNodeBeingEdited && !isDesktopFullScreenTitleNode && (
              <NodeAutoLink>
                <InteractiveNodeContent />
              </NodeAutoLink>
            )}
            {!isNodeBeingEdited && isDesktopFullScreenTitleNode && (
              <InteractiveNodeContent editOnClick />
            )}
            {displayMenu && <NodeMenu />}
          </div>
        </>
      )}
    </NodeCard>
  );
}

export const NOTE_TYPE = "note";
