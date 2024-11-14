import React from "react";
import { Modal } from "react-bootstrap";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import QRCode from "qrcode.react";
import { useData } from "./DataContext";
import { useNode } from "./ViewContext";
import { DeedsatsLogo } from "./DeedsatsLogo";

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
          Unlock Access to This Project by using your Deedsats Wallet
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
  if (!node || node.type !== "project") {
    return null;
  }
  return (
    <button type="button" className="btn always-visible">
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
