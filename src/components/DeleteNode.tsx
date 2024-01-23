import { Set, List } from "immutable";
import React from "react";
import { Dropdown } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { deleteRelations, isRemote, joinID, splitID } from "../connections";
import { getWorkspaces } from "../KnowledgeDataContext";
import {
  updateViewPathsAfterDeletion,
  upsertRelations,
  useNode,
  viewPathToString,
} from "../ViewContext";
import { Button } from "./Ui";
import { useData } from "../DataContext";
import { newDB } from "../knowledge";
import {
  Plan,
  planDeleteNode,
  planUpdateViews,
  planUpdateWorkspaces,
  usePlanner,
} from "../planner";

export function disconnectNode(plan: Plan, toDisconnect: LongID): Plan {
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
    const path = {
      root: relation.head,
      indexStack: List<number>([]),
    };
    // Modify View that the correct relation type is used
    const ephemeralView: View = {
      displaySubjects: false,
      relations: relation.id,
      width: 1,
      expanded: false,
    };
    const userDB = rdx.knowledgeDBs.get(rdx.user.publicKey, newDB());
    const views = userDB.views.set(viewPathToString(path), ephemeralView);
    const planWithDeletedRelation = upsertRelations(
      {
        ...rdx,
        knowledgeDBs: rdx.knowledgeDBs.set(rdx.user.publicKey, {
          ...userDB,
          views,
        }),
      },
      path,
      (relations) => deleteRelations(relations, toDelete)
    );
    const userDBAfterDeletion = planWithDeletedRelation.knowledgeDBs.get(
      planWithDeletedRelation.user.publicKey,
      newDB()
    );

    const viewsAfterDeletion = updateViewPathsAfterDeletion(
      planWithDeletedRelation.knowledgeDBs,
      userDBAfterDeletion.views,
      rdx.user.publicKey,
      path,
      toDelete
    );
    return planUpdateViews(planWithDeletedRelation, viewsAfterDeletion);
  }, plan);
}

function useDeleteNode(): undefined | (() => void) {
  const [node] = useNode();
  const navigate = useNavigate();
  const { createPlan, executePlan } = usePlanner();
  const { knowledgeDBs, user } = useData();
  const myDB = knowledgeDBs.get(user.publicKey, newDB());

  // Can only delete my own nodes
  if (!node || isRemote(splitID(node.id)[0], user.publicKey)) {
    return undefined;
  }

  return () => {
    navigate("/");
    const planWithDisconnectedNode = disconnectNode(createPlan(), node.id);
    const planWithDeletedNode = planDeleteNode(
      planWithDisconnectedNode,
      node.id
    );
    if (myDB.workspaces.filter((id) => id === node.id).size > 0) {
      const updatedWorkspaces = myDB.workspaces.filter((id) => id !== node.id);
      const activeWorkspace =
        myDB.activeWorkspace === node.id
          ? getWorkspaces(
              planWithDeletedNode.knowledgeDBs.set(user.publicKey, {
                ...myDB,
                workspaces: updatedWorkspaces,
              }),
              user.publicKey
            ).first({ id: joinID(user.publicKey, "my-first-workspace") }).id
          : myDB.activeWorkspace;
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
