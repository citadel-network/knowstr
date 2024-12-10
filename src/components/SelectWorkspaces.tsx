import React, { useState } from "react";
import { Dropdown, Modal, Form, InputGroup, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { FormControlWrapper } from "../commons/InputElementUtils";
import { newNode, newWorkspace } from "../connections";
import { useData } from "../DataContext";
import { planAddWorkspace, planUpsertNode, usePlanner } from "../planner";
import { RemoteWorkspaces, UserWorkspaces } from "./SelectWorkspaceSection";

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

/* eslint-disable react/no-array-index-key */
export function SelectWorkspaces(): JSX.Element {
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] =
    useState<boolean>(false);

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
        <UserWorkspaces />
        <RemoteWorkspaces />
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
