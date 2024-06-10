import { List } from "immutable";
import React, { useEffect } from "react";
import { useMediaQuery } from "react-responsive";
import { matchPath, useLocation, useParams } from "react-router-dom";
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
} from "../ViewContext";
import {
  NodeSelectbox,
  toggleEditing,
  useTemporaryView,
  useIsEditingOn,
  useIsParentMultiselectBtnOn,
} from "./TemporaryViewContext";
import { IS_MOBILE } from "./responsive";
import { AddNodeToNode } from "./AddNode";
import { NodeMenu } from "./Menu";
import { DeleteNode } from "./DeleteNode";
import { useData } from "../DataContext";
import { planUpsertNode, usePlanner } from "../planner";
import { ReactQuillWrapper } from "./ReactQuillWrapper";
import { useNodeIsLoading } from "../LoadingStatus";

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
  const isLoading = useNodeIsLoading();
  if (isLoading) {
    return <LoadingNode />;
  }
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
  const levels = getLevels(viewPath, isOpenInFullScreen);
  const isAddToNode = useIsAddToNode();
  const isNodeBeingEdited = useIsEditingOn();
  const isMultiselect = useIsParentMultiselectBtnOn();
  const displayMenu = levels > 0;
  const cls = !isMobile ? `${className || ""} hover-light-bg` : className;
  return (
    <NodeCard
      className={cls}
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
            {!isNodeBeingEdited && <NodeContent />}
            {displayMenu && <NodeMenu />}
          </div>
        </>
      )}
    </NodeCard>
  );
}

export const NOTE_TYPE = "note";
