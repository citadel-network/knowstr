import { Set } from "immutable";
import React from "react";
import { Dropdown } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { Button } from "citadel-commons";
import { deleteRelations, isRemote, splitID } from "../connections";
import { getWorkspacesWithNodes } from "../KnowledgeDataContext";
import {
  updateViewPathsAfterDeleteNode,
  useNode,
  useNodeID,
} from "../ViewContext";
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
import { isUserLoggedIn, useDefaultWorkspace } from "../NostrAuthContext";
import { isMutableNode } from "./TemporaryViewContext";

function disconnectNode(plan: Plan, toDisconnect: LongID | ID): Plan {
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
  const [nodeID] = useNodeID();
  const [node] = useNode();
  const navigate = useNavigate();
  const { createPlan, executePlan } = usePlanner();
  const data = useData();
  const defaultWorkspace = useDefaultWorkspace();
  const isLoggedIn = isUserLoggedIn(data.user);

  // Can't delete my contacts nodes, except for active workspace
  // Can't delete the default workspace if not logged in
  if (
    (isRemote(splitID(nodeID)[0], data.user.publicKey) &&
      data.activeWorkspace !== nodeID) ||
    (defaultWorkspace === nodeID && !isLoggedIn)
  ) {
    return undefined;
  }

  return () => {
    navigate("/");
    const planWithDisconnectedNode = disconnectNode(createPlan(), nodeID);
    const planWithDeletedNode = isMutableNode(node, data.user)
      ? planDeleteNode(planWithDisconnectedNode, nodeID)
      : planWithDisconnectedNode;
    if (
      data.workspaces.filter((id) => id === nodeID).size > 0 ||
      data.activeWorkspace === nodeID
    ) {
      const updatedWorkspaces = data.workspaces.filter((id) => id !== nodeID);
      const newActiveWs = getWorkspacesWithNodes(
        updatedWorkspaces.toSet(),
        data
      ).first(undefined);
      const activeWorkspace =
        data.activeWorkspace === nodeID
          ? newActiveWs?.id
          : data.activeWorkspace;
      executePlan(
        planUpdateWorkspaces(
          planWithDeletedNode,
          updatedWorkspaces,
          activeWorkspace
        )
      );
      navigate(activeWorkspace ? `/w/${activeWorkspace}` : "/");
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
