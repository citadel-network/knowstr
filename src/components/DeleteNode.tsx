import { Set } from "immutable";
import React from "react";
import { Dropdown } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { Button } from "citadel-commons";
import { deleteRelations } from "../connections";
import { getWorkspaces } from "../KnowledgeDataContext";
import { updateViewPathsAfterDeleteNode, useNode } from "../ViewContext";
import { useData } from "../DataContext";
import { newDB } from "../knowledge";
import {
  Plan,
  planDeleteNode,
  planUpdateViews,
  planUpdateWorkspaces,
  planUpsertRelations,
  usePlanner,
} from "../planner";
import { defaultWorkspaceID } from "../Data";

function disconnectNode(plan: Plan, toDisconnect: ID): Plan {
  const myDB = plan.knowledgeDBs.get(plan.user.publicKey, newDB());
  return myDB.relations.reduce((rdx, relation) => {
    const toDelete = relation.items.reduce((indices, id, idx) => {
      if (id === toDisconnect) {
        return indices.add(idx);
      }
      return indices;
    }, Set<number>());
    if (toDelete.size === 0) {
      return rdx;
    }
    return planUpsertRelations(rdx, deleteRelations(relation, toDelete));
  }, planUpdateViews(plan, updateViewPathsAfterDeleteNode(plan.views, toDisconnect)));
}

function useDeleteNode(): undefined | (() => void) {
  const [node] = useNode();
  const navigate = useNavigate();
  const { createPlan, executePlan } = usePlanner();
  const data = useData();

  // Can only delete my own nodes
  if (!node || node.author !== data.user.publicKey) {
    return undefined;
  }

  return () => {
    navigate("/");
    const planWithDisconnectedNode = disconnectNode(createPlan(), node.id);
    const planWithDeletedNode = planDeleteNode(
      planWithDisconnectedNode,
      node.id
    );
    if (data.workspaces.filter((id) => id === node.id).size > 0) {
      const updatedWorkspaces = data.workspaces.filter((id) => id !== node.id);
      const updatedData = {
        ...data,
        workspaces: updatedWorkspaces,
      };
      const activeWorkspace =
        data.activeWorkspace === node.id
          ? getWorkspaces(updatedData).first({
              id: defaultWorkspaceID(data.user.publicKey),
            }).id
          : data.activeWorkspace;

      executePlan(
        planUpdateWorkspaces(
          planWithDeletedNode,
          updatedWorkspaces,
          activeWorkspace
        )
      );
    } else {
      executePlan(planWithDeletedNode);
    }
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
