import React, { useEffect } from "react";
import ReactQuill from "react-quill";
import { useMediaQuery } from "react-responsive";
import { matchPath, useLocation, useParams } from "react-router-dom";
import {
  branchPathToString,
  ensureLocalBranch,
  getDefaultBranch,
  getNode,
  newRepo,
} from "../knowledge";
import {
  shorten,
  useUpdateKnowledge,
  useKnowledgeData,
  useGetNodeText,
} from "../KnowledgeDataContext";
import { addRelationToNode, newNode } from "../connections";
import {
  updateNode,
  useIsAddToNode,
  useParentRepo,
  useRepo,
  useViewPath,
  getParentView,
  getParentRepo,
  useViewKey,
  getRepoFromView,
} from "../ViewContext";
import { Button, CloseButton } from "./Ui";
import useModal from "./useModal";
import { ESC, SearchModal } from "./SearchModal";
import { IS_MOBILE } from "./responsive";
import { getLevels, useIsOpenInFullScreen } from "./Node";
import { FULL_SCREEN_PATH } from "../App";
import {
  openEditor,
  closeEditor,
  useTemporaryView,
  useIsEditorOpen,
} from "./TemporaryViewContext";

function isAddSummary(repo: Repo | undefined, view: View | undefined): boolean {
  const nodeType = repo !== undefined ? getNode(repo).nodeType : undefined;
  return (
    (nodeType === "NOTE" || nodeType === "QUOTE") &&
    view?.relationType === "SUMMARY"
  );
}

function useIsAddSummary(): boolean {
  const { repos, views } = useKnowledgeData();
  const viewPath = useViewPath();
  const isOpenInFullScreen = useIsOpenInFullScreen();
  const [repo, view] = getRepoFromView(repos, views, viewPath);
  const [parentRepo, parentView] = getParentRepo(repos, views, viewPath);
  const level = getLevels(viewPath, isOpenInFullScreen);
  return level === 0
    ? isAddSummary(repo, view)
    : isAddSummary(parentRepo, parentView);
}

function AddNodeButton({
  onClick,
  ariaLabel,
}: {
  onClick: () => void;
  ariaLabel: string;
}): JSX.Element {
  const isSummaryAdded = useIsAddSummary();
  const isInline = useIsAddToNode() || useMediaQuery(IS_MOBILE);
  const className = isInline
    ? "workspace-droppable font-italic font-size-medium black-dimmed hover-black-dimmed"
    : "workspace-droppable";
  const text = isSummaryAdded ? "Add Summary" : "Add Note";
  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {!isInline && <span className="simple-icon-plus me-2" />}
      <span>{text}</span>
      <span>{}</span>
    </button>
  );
}

type AddSummaryButtonProps = {
  onClick: (nodeType: NodeType, relationType?: RelationType) => void;
  buttonText?: string;
};

function AddSummaryButton({
  onClick,
  buttonText,
}: AddSummaryButtonProps): JSX.Element {
  return (
    <Button
      onClick={() => {
        return onClick("NOTE", "SUMMARY");
      }}
    >
      <div>{buttonText || "Add Summary"}</div>
    </Button>
  );
}

function SearchButton({ onClick }: { onClick: () => void }): JSX.Element {
  return (
    <button
      className="btn btn-borderless p-0"
      type="button"
      onClick={onClick}
      aria-label="search"
    >
      <span className="simple-icon-magnifier" />
      <span className="visually-hidden">Search</span>
    </button>
  );
}
type EditorProps = {
  onCreateNode: (
    text: string,
    nodeType: NodeType,
    relationType?: RelationType
  ) => void;
  onClose: () => void;
};

function Editor({ onCreateNode, onClose }: EditorProps): JSX.Element {
  const isSummaryAdded = useIsAddSummary();
  const ref = React.createRef<ReactQuill>();

  useEffect(() => {
    (ref.current as ReactQuill).focus();
  }, []);

  const onSave = (nodeType: NodeType, relationType?: RelationType): void => {
    if (!ref.current) {
      return;
    }
    onCreateNode(ref.current.getEditor().getText(), nodeType, relationType);
  };

  return (
    <div className="editor">
      <div className="scrolling-container">
        <ReactQuill
          theme="bubble"
          formats={[]}
          modules={{ toolbar: false }}
          placeholder={isSummaryAdded ? "Create a Summary" : "Create a Note"}
          scrollingContainer="scrolling-container"
          ref={ref}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.keyCode === ESC) {
              onClose();
            }
          }}
        />
      </div>
      <div>
        {isSummaryAdded ? (
          <AddSummaryButton onClick={onSave} />
        ) : (
          <Button onClick={() => onSave("NOTE")}>Add Note</Button>
        )}
        <CloseButton onClose={onClose} />
      </div>
    </div>
  );
}

function useIsFullScreen(): boolean {
  const location = useLocation();
  return matchPath(FULL_SCREEN_PATH, location.pathname) !== null;
}

function useGetFullScreenViewRepo(): string | undefined {
  const { openNodeID: id } = useParams<{
    openNodeID: string;
  }>();
  const repo = useRepo()[0];
  return repo && id !== undefined && id === repo.id ? id : undefined;
}

type AddNodeProps = {
  onCreateNewNode: (
    text: string,
    nodeType: NodeType,
    relationType?: RelationType
  ) => void;
  onAddExistingNode: (
    node: Repo,
    branch: BranchPath,
    relationType?: RelationType
  ) => void;
  ariaLabel: string;
  isSearchEnabledByShortcut?: boolean;
};

function AddNode({
  ariaLabel,
  onCreateNewNode,
  onAddExistingNode,
  isSearchEnabledByShortcut,
}: AddNodeProps): JSX.Element {
  const isMobile = useMediaQuery(IS_MOBILE);
  const { openModal, closeModal, isOpen } = useModal();
  const { editorOpenViews, setEditorOpenState } = useTemporaryView();
  const viewKey = useViewKey();
  const isEditorOpen = useIsEditorOpen();
  const isFullScreen = useIsFullScreen();
  const isSearchModalInFullScreen = useGetFullScreenViewRepo();
  // disable shortcut for SearchModal if the AddNode Element in Column if AddNode Element in FullScreenView is opened
  const disableSearchModal =
    isFullScreen && isSearchModalInFullScreen === undefined;
  const reset = (): void => {
    setEditorOpenState(closeEditor(editorOpenViews, viewKey));
  };

  useEffect((): (() => void) | undefined => {
    if (isSearchEnabledByShortcut) {
      const handler = (event: KeyboardEvent): void => {
        if (event.key === "/" && !isOpen) {
          openModal();
        }
      };
      if (!disableSearchModal) {
        window.addEventListener("keyup", handler);
      }
      return () => {
        window.removeEventListener("keyup", handler);
        if (isOpen) {
          closeModal();
        }
      };
    }
    return undefined;
  }, [disableSearchModal]);

  const createNewNode = (
    text: string,
    nodeType: NodeType,
    relationType?: RelationType
  ): void => {
    onCreateNewNode(text, nodeType, relationType);
    reset();
  };

  const onAddExistingRepo = (node: Repo, relationType?: RelationType): void => {
    if (isOpen) {
      closeModal();
    }
    const branch = getDefaultBranch(node);
    if (branch) {
      onAddExistingNode(node, branch, relationType);
    }
  };

  return (
    <>
      {isOpen && (
        <SearchModal
          onAddExistingRepo={onAddExistingRepo}
          onHide={closeModal}
        />
      )}
      <div className="w-100">
        {!isEditorOpen && (
          <div
            className={`d-flex background-white ${
              !isMobile ? "hover-light-bg" : ""
            }`}
          >
            <AddNodeButton
              ariaLabel={ariaLabel}
              onClick={() => {
                setEditorOpenState(openEditor(editorOpenViews, viewKey));
              }}
            />
            <div className="flex-row-end">
              <SearchButton onClick={openModal} />
            </div>
          </div>
        )}
        {isEditorOpen && (
          <Editor onCreateNode={createNewNode} onClose={reset} />
        )}
      </div>
    </>
  );
}

export function AddColumn(): JSX.Element {
  const isOpenInFullScreen = useIsOpenInFullScreen();
  const [workspace, workspaceBranch] = useRepo();
  const viewPath = useViewPath();
  const upsertRepos = useUpdateKnowledge();
  const { repos, views } = useKnowledgeData();
  if (!workspace || !workspaceBranch) {
    return <div />;
  }

  const onAddRepo = (repo: Repo): void => {
    upsertRepos(
      updateNode(
        repos.set(repo.id, repo),
        views,
        viewPath,
        (dashboard, { view }) =>
          addRelationToNode(dashboard, repo.id, view.relationType)
      )
    );
  };

  const onCreateNewNode = (text: string, nodeType: NodeType): void =>
    onAddRepo(newRepo(newNode(text, nodeType)));

  return (
    <AddNode
      onCreateNewNode={onCreateNewNode}
      onAddExistingNode={onAddRepo}
      ariaLabel="add node"
      isSearchEnabledByShortcut={!isOpenInFullScreen}
    />
  );
}

export function AddNodeToNode(): JSX.Element | null {
  const { repos, views } = useKnowledgeData();
  const upsertRepos = useUpdateKnowledge();
  const getNodeText = useGetNodeText();
  const isAddToNode = useIsAddToNode();
  const isOpenInFullScreen = useIsOpenInFullScreen();
  const vContext = useViewPath();
  const viewContext = isAddToNode ? getParentView(vContext) : vContext;
  const [repo, view] = isAddToNode ? useParentRepo() : useRepo();
  if (!repo || !viewContext) {
    return null;
  }

  const onCreateNewNode = (
    text: string,
    nodeType: NodeType,
    relationType?: RelationType
  ): void => {
    const node = newNode(text, nodeType);
    const toAdd = newRepo(node);
    upsertRepos(
      updateNode(repos.set(toAdd.id, toAdd), views, viewContext, (n, ctx) =>
        addRelationToNode(n, toAdd.id, relationType || ctx.view.relationType)
      )
    );
  };

  const onAddExistingNode = (
    addRepo: Repo,
    branch: BranchPath,
    relationType?: RelationType
  ): void => {
    const defaultBranch = getDefaultBranch(addRepo);
    // repo doesn't have any branches
    if (!defaultBranch) {
      return;
    }
    upsertRepos(
      updateNode(
        repos.set(
          addRepo.id,
          // ensure that there is a local copy of this branch
          ensureLocalBranch(addRepo, defaultBranch)[0]
        ),
        views,
        viewContext,
        (n, ctx) =>
          addRelationToNode(
            n,
            addRepo.id,
            relationType || ctx.view.relationType
          )
      )
    );
  };

  return (
    <AddNode
      onCreateNewNode={onCreateNewNode}
      onAddExistingNode={onAddExistingNode}
      ariaLabel={`add to ${shorten(
        getNodeText(getNode(repo, view.branch))
      )} [${branchPathToString(view.branch)}]`}
      isSearchEnabledByShortcut={isOpenInFullScreen && !isAddToNode}
    />
  );
}
