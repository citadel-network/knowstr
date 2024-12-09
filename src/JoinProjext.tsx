import React, { useCallback } from "react";
import { Modal } from "react-bootstrap";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import QRCode from "qrcode.react";
import { useData } from "./DataContext";
import { useNode } from "./ViewContext";
import { DeedsatsLogo } from "./DeedsatsLogo";
import { planBookmarkProject, usePlanner } from "./planner";
import { isProjectNode } from "./knowledge";
import { useProjectContext } from "./ProjectContext";

// TODO: Keep checking if project is joined

export function JoinProject(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useData();
  const { projectID } = useParams<{
    projectID: string;
  }>();
  const identifier = `${projectID}&${user.publicKey}`;

  const referrer = (location.state as LocationState | undefined)?.referrer;

  const onHide = (): void => {
    navigate(referrer || "/");
  };

  return (
    <Modal show onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>
          Unlock Access to this Project by using your Deedsats Wallet
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="container-fluid">
          <div className="flex-row-center m-2">
            <QRCode value={identifier} level="M" size={300} />
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}

export function JoinProjectButton(): JSX.Element | null {
  const [node] = useNode();
  const { createPlan, executePlan } = usePlanner();
  const navigate = useNavigate();
  const { bookmarkedProjects } = useProjectContext();
  // TODO: check if user is approved, depends on relay implementation, for now always false
  const isApproved = false;
  const joinProject = useCallback((): void => {
    if (!node || !isProjectNode(node)) {
      return;
    }
    executePlan(planBookmarkProject(createPlan(), node));
    if (isApproved) {
      navigate(`/w/${node.dashboardInternal}`);
    } else {
      navigate(`/join/${node.id}`);
    }
  }, [node]);

  if (!node || !isProjectNode(node)) {
    return null;
  }

  if (bookmarkedProjects.includes(node.id)) {
    if (!isApproved) {
      return (
        <Link className="btn always-visible" to={`/join/${node.id}`}>
          <DeedsatsLogo
            styles={{
              maxHeight: "20px",
              position: "relative",
              top: "-1px",
              marginRight: "5px",
            }}
          />
          Waiting for Approval
        </Link>
      );
    }
    return (
      <Link className="btn always-visible" to={`/w/${node.dashboardInternal}`}>
        <DeedsatsLogo
          styles={{
            maxHeight: "20px",
            position: "relative",
            top: "-1px",
            marginRight: "5px",
          }}
        />
        Go to Project Dashboard
      </Link>
    );
  }

  return (
    <button type="button" className="btn always-visible" onClick={joinProject}>
      <DeedsatsLogo
        styles={{
          maxHeight: "20px",
          position: "relative",
          top: "-1px",
          marginRight: "5px",
        }}
      />
      Join Project
    </button>
  );
}
