import React, { useState } from "react";
import {
  Dropdown,
  Modal,
  Form,
  InputGroup,
  FormControl,
  Button,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import {
  getWorkspaceInfo,
  getWorkspaces,
  useKnowledgeData,
  useUpdateKnowledge,
} from "../KnowledgeDataContext";
import { getNode, newRepo } from "../knowledge";
import { newNode } from "../connections";

type NewWorkspaceProps = {
  onHide: () => void;
};

function NewWorkspace({ onHide }: NewWorkspaceProps): JSX.Element {
  const navigate = useNavigate();
  const { repos, views } = useKnowledgeData();
  const updateKnowledge = useUpdateKnowledge();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const form = event.currentTarget;
    if (form.checkValidity() === false) {
      return;
    }
    const title = (form.elements.namedItem("title") as HTMLInputElement).value;
    const repo = newRepo(newNode(`${title}`, "WORKSPACE"));
    updateKnowledge({
      repos: repos.set(repo.id, repo),
      activeWorkspace: repo.id,
      views,
    });
    navigate(`/w/${repo.id}`);
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
            <FormControl
              aria-label="title of new workspace"
              name="title"
              required
            />
          </InputGroup>
        </Modal.Body>
        <Modal.Footer>
          <Button type="submit">Create Workspace</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function ListItem({ id, title }: { id: string; title: string }): JSX.Element {
  const navigate = useNavigate();
  const updateKnowledge = useUpdateKnowledge();
  return (
    <Dropdown.Item
      className="d-flex workspace-selection"
      onClick={() => {
        updateKnowledge({
          activeWorkspace: id,
        });
        navigate(`/w/${id}`);
      }}
      key={id}
    >
      <div className="workspace-selection-text">{title}</div>
    </Dropdown.Item>
  );
}

/* eslint-disable react/no-array-index-key */
export function SelectWorkspaces(): JSX.Element {
  const [newWorkspace, setNewWorkspace] = useState<boolean>(false);
  const workspaces = getWorkspaces(useKnowledgeData().repos);

  const localWorkspaces = workspaces.filter((repo) => repo.branches.size > 0);
  const remoteOnlyWorkspaces = workspaces.filterNot((repo) =>
    localWorkspaces.has(repo.id)
  );

  return (
    <Dropdown aria-label="workspace selection">
      {newWorkspace && <NewWorkspace onHide={() => setNewWorkspace(false)} />}
      <Dropdown.Toggle
        as="button"
        className="btn"
        aria-label="switch workspace"
      >
        <span className="simple-icon-layers" />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Item className="project-selection">
          <div>Your Workspaces</div>
        </Dropdown.Item>
        {localWorkspaces.toArray().map(([id, workspace]) => (
          <ListItem
            key={id}
            id={id}
            title={getWorkspaceInfo(getNode(workspace)).title}
          />
        ))}
        {remoteOnlyWorkspaces.size > 0 && (
          <>
            <Dropdown.Item className="project-selection">
              <div>Your Contacts Workspaces</div>
            </Dropdown.Item>
            {remoteOnlyWorkspaces.toArray().map(([id, workspace]) => (
              <ListItem
                key={id}
                id={id}
                title={getWorkspaceInfo(getNode(workspace)).title}
              />
            ))}
          </>
        )}
        <Dropdown.Divider />
        <Dropdown.Item
          className="d-flex workspace-selection"
          onClick={() => setNewWorkspace(true)}
        >
          <div className="workspace-selection-text">New Workspace</div>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}
