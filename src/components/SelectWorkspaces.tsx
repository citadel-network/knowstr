import React, { useState } from "react";
import { Dropdown, Modal, Form, InputGroup, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { FormControlWrapper } from "citadel-commons";
import { getWorkspaces } from "../KnowledgeDataContext";
import { isRemote, newNode } from "../connections";
import { useData } from "../DataContext";
import { planUpdateWorkspaces, planUpsertNode, usePlanner } from "../planner";

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
    const newNodePlan = planUpsertNode(createPlan(), node);
    // set node as active
    const myDB = newNodePlan.knowledgeDBs.get(newNodePlan.user.publicKey);
    if (!myDB) {
      executePlan(newNodePlan);
      return;
    }
    const setActivePlan = planUpdateWorkspaces(
      newNodePlan,
      newNodePlan.workspaces.push(node.id),
      node.id
    );
    executePlan(setActivePlan);
    navigate(`/w/${node.id}`);
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

function ListItem({ id, title }: { id: ID; title: string }): JSX.Element {
  const { workspaces } = useData();
  const { createPlan, executePlan } = usePlanner();
  const navigate = useNavigate();

  const onClick = (): void => {
    executePlan(planUpdateWorkspaces(createPlan(), workspaces, id));
    navigate(`/w/${id}`);
  };

  return (
    <Dropdown.Item
      className="d-flex workspace-selection"
      onClick={onClick}
      key={id}
      tabIndex={0}
    >
      <div className="workspace-selection-text">{title}</div>
    </Dropdown.Item>
  );
}

/* eslint-disable react/no-array-index-key */
export function SelectWorkspaces(): JSX.Element {
  const [newWorkspace, setNewWorkspace] = useState<boolean>(false);
  const data = useData();
  const workspaces = getWorkspaces(data);

  const localWorkspaces = workspaces.filter(
    (node) => !isRemote(node.author, data.user.publicKey)
  );
  const remoteOnlyWorkspaces = workspaces.filter((node) =>
    isRemote(node.author, data.user.publicKey)
  );

  return (
    <Dropdown aria-label="workspace selection">
      {newWorkspace && <NewWorkspace onHide={() => setNewWorkspace(false)} />}
      <Dropdown.Toggle
        as="button"
        className="btn"
        aria-label="switch workspace"
        tabIndex={0}
      >
        <span className="simple-icon-layers" />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Item className="project-selection">
          <div>Your Workspaces</div>
        </Dropdown.Item>
        {localWorkspaces.toArray().map((workspace) => (
          <ListItem
            key={workspace.id}
            id={workspace.id}
            title={workspace.text}
          />
        ))}
        {remoteOnlyWorkspaces.size > 0 && (
          <>
            <Dropdown.Item className="project-selection">
              <div>Your Contacts Workspaces</div>
            </Dropdown.Item>
            {remoteOnlyWorkspaces.toArray().map((workspace) => (
              <ListItem
                key={workspace.id}
                id={workspace.id}
                title={workspace.text}
              />
            ))}
          </>
        )}
        <Dropdown.Divider />
        <Dropdown.Item
          className="d-flex workspace-selection"
          onClick={() => setNewWorkspace(true)}
          tabIndex={0}
        >
          <div className="workspace-selection-text">New Workspace</div>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}
