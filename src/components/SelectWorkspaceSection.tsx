import React from "react";
import { Dropdown } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { Map } from "immutable";
import { useWorkspaceContext } from "../WorkspaceContext";
import { useData } from "../DataContext";
import { getNodeFromID } from "../ViewContext";

function ListItem({ workspace }: { workspace: Workspace }): JSX.Element {
  const { setCurrentWorkspace } = useWorkspaceContext();
  const navigate = useNavigate();
  const { knowledgeDBs, user } = useData();
  const node = getNodeFromID(knowledgeDBs, workspace.node, user.publicKey);

  const onClick = (): void => {
    setCurrentWorkspace(workspace.id);
    navigate(`/w/${workspace.id}`);
  };

  return (
    <Dropdown.Item
      className="d-flex workspace-selection"
      onClick={onClick}
      tabIndex={0}
    >
      <div className="workspace-selection-text">
        {node?.text || "Loading..."}
      </div>
    </Dropdown.Item>
  );
}

export function UserWorkspaces(): JSX.Element | null {
  const { user } = useData();
  const localWorkspaces = useWorkspaceContext().workspaces.get(user.publicKey);

  if (!localWorkspaces || localWorkspaces.size === 0) {
    return null;
  }
  return (
    <>
      <Dropdown.Item className="project-selection">
        <div>Your Workspaces</div>
      </Dropdown.Item>
      {localWorkspaces
        .valueSeq()
        .toArray()
        .map((workspace) => (
          <ListItem workspace={workspace} key={workspace.id} />
        ))}
    </>
  );
}

export function RemoteWorkspaces(): JSX.Element | null {
  const { user } = useData();

  const remoteOnlyWorkspaces = useWorkspaceContext()
    .workspaces.remove(user.publicKey)
    .reduce((acc, workspaces) => acc.merge(workspaces), Map<ID, Workspace>());

  if (remoteOnlyWorkspaces.size === 0) {
    return null;
  }
  return (
    <>
      <Dropdown.Item className="project-selection">
        <div>Other Users Workspaces</div>
      </Dropdown.Item>
      {remoteOnlyWorkspaces
        .valueSeq()
        .toArray()
        .map((workspace) => (
          <ListItem workspace={workspace} key={workspace.id} />
        ))}
    </>
  );
}
