import { Set, List } from "immutable";
import React from "react";
import { Dropdown } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { deleteRelationsFromNode, getRelations } from "../connections";
import { getNode } from "../knowledge";
import {
  getWorkspaces,
  useKnowledgeData,
  useUpdateKnowledge,
} from "../KnowledgeDataContext";
import {
  getNodeFromView,
  updateNode,
  updateViewPathsAfterDeletion,
  useNode,
} from "../ViewContext";
import { Button } from "./Ui";

export function disconnectNode(
  data: { repos: Repos; views: Views },
  toDisconnect: string
): { repos: Repos; views: Views } {
  return data.repos.reduce((rdx, { id }) => {
    const path = {
      root: id,
      indexStack: List<number>([]),
    };
    const [repo, view] = getNodeFromView(rdx.repos, rdx.views, path);
    if (!repo) {
      return rdx;
    }
    const node = getNode(repo, view.branch);
    const relations = getRelations(node, view.relationType);
    const toDelete = relations.reduce((indices, relation, index) => {
      if (relation.id === toDisconnect) {
        return indices.add(index);
      }
      return indices;
    }, Set<number>());
    if (toDelete.size === 0) {
      return rdx;
    }
    const d = updateNode(rdx.repos, rdx.views, path, (n) =>
      deleteRelationsFromNode(n, toDelete, view.relationType)
    );
    return {
      repos: d.repos,
      views: updateViewPathsAfterDeletion(d.repos, d.views, path, toDelete),
    };
  }, data);
}

// Finds the next active workspace, in case there are no workspaces
// it returns undefined and KnowledgeDataContext takes care of it
function findNewActiveWorkspace(repos: Repos): undefined | string {
  const newActive = getWorkspaces(repos).first(undefined);
  return newActive ? newActive.id : undefined;
}

function useDeleteNode(): undefined | (() => void) {
  const [repo] = useNode();
  const navigate = useNavigate();
  const { repos, activeWorkspace, views } = useKnowledgeData();
  const updateKnowledge = useUpdateKnowledge();
  if (!repo) {
    return undefined;
  }
  return () => {
    navigate("/");
    const { repos: updatedRepos, views: updatedViews } = disconnectNode(
      { repos, views },
      repo.id
    );
    const finalRepos = updatedRepos.remove(repo.id);
    updateKnowledge({
      repos: finalRepos,
      views: updatedViews,
      activeWorkspace:
        activeWorkspace === repo.id
          ? findNewActiveWorkspace(finalRepos)
          : activeWorkspace,
    });
  };
}

export function DeleteNode({
  as,
  withCaption,
  afterOnClick,
}: {
  as?: "button" | "item";
  withCaption?: boolean;
  afterOnClick?: () => void;
}): JSX.Element | null {
  const deleteNode = useDeleteNode();
  if (!deleteNode) {
    return null;
  }

  if (as === "item") {
    return (
      <Dropdown.Item
        className="d-flex workspace-selection dropdown-item-border-bottom"
        tabIndex={0}
      >
        <span className="simple-icon-trash d-block dropdown-item-icon" />
        <div className="workspace-selection-text">Delete Workspace</div>
      </Dropdown.Item>
    );
  }

  return (
    <Button
      onClick={() => {
        deleteNode();
        if (afterOnClick !== undefined) {
          afterOnClick();
        }
      }}
      className="btn font-size-small"
      ariaLabel="delete node"
    >
      <span className="simple-icon-trash" />
      {withCaption && <span className="ms-2">Delete</span>}
    </Button>
  );
}
