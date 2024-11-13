import React, { useState } from "react";
import { Dropdown, Modal, Form, InputGroup, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { Map } from "immutable";
import { FormControlWrapper } from "../commons/InputElementUtils";
import { newNode, newWorkspace } from "../connections";
import { useData } from "../DataContext";
import { planAddWorkspace, planUpsertNode, usePlanner } from "../planner";
import { useWorkspaceContext } from "../WorkspaceContext";
import { getNodeFromID } from "../ViewContext";

type NewWorkspaceProps = {
  onHide: () => void;
};

function NewWorkspace({ onHide }: NewWorkspaceProps): JSX.Element {
  const navigate = useNavigate();
  const { createPlan, executePlan } = usePlanner();
  const { user } = useData();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const form = event.currentTarget;
    if (form.checkValidity() === false) {
      return;
    }
    const title = (form.elements.namedItem("title") as HTMLInputElement).value;
    const node = newNode(title, user.publicKey);
    const workspace = newWorkspace(node.id, user.publicKey);

    const newNodePlan = planUpsertNode(createPlan(), node);
    const newWorkspacePlan = planAddWorkspace(newNodePlan, workspace);
    executePlan(newWorkspacePlan);
    navigate(`/w/${workspace.id}`);
    onHide();
  };

  return (
    <Modal show onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>New Workspace</Modal.Title>
      </Modal.Header>
      <Form onSubmit={onSubmit}>
        <Modal.Body>
          <InputGroup>
            <InputGroup.Text>Title</InputGroup.Text>
            <FormControlWrapper
              aria-label="title of new workspace"
              name="title"
              required
            />
          </InputGroup>
        </Modal.Body>
        <Modal.Footer>
          <Button type="submit" tabIndex={0}>
            Create Workspace
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

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

/* eslint-disable react/no-array-index-key */
export function SelectWorkspaces(): JSX.Element {
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] =
    useState<boolean>(false);
  const data = useData();

  const { localWorkspaces, remoteOnlyWorkspaces } =
    useWorkspaceContext().workspaces.reduce(
      (acc, workspaces, author) => {
        const isRemote = author !== data.user.publicKey;
        if (isRemote) {
          return {
            ...acc,
            remoteOnlyWorkspaces: acc.remoteOnlyWorkspaces.merge(workspaces),
          };
        }
        return {
          ...acc,
          localWorkspaces: acc.localWorkspaces.merge(workspaces),
        };
      },
      {
        localWorkspaces: Map<ID, Workspace>(),
        remoteOnlyWorkspaces: Map<ID, Workspace>(),
      }
    );

  return (
    <Dropdown aria-label="workspace selection">
      {showNewWorkspaceModal && (
        <NewWorkspace onHide={() => setShowNewWorkspaceModal(false)} />
      )}
      <Dropdown.Toggle
        as="button"
        className="btn"
        aria-label="switch workspace"
        tabIndex={0}
      >
        <span className="simple-icon-layers" />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {localWorkspaces.size > 0 && (
          <Dropdown.Item className="project-selection">
            <div>Your Workspaces</div>
          </Dropdown.Item>
        )}
        {localWorkspaces
          .valueSeq()
          .toArray()
          .map((workspace) => (
            <ListItem workspace={workspace} key={workspace.id} />
          ))}
        {remoteOnlyWorkspaces.size > 0 && (
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
        )}
        <Dropdown.Divider />
        <Dropdown.Item
          className="d-flex workspace-selection"
          onClick={() => setShowNewWorkspaceModal(true)}
          tabIndex={0}
        >
          <div className="workspace-selection-text">New Workspace</div>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}
