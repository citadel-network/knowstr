import React from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "react-bootstrap";
import { nip19 } from "nostr-tools";
import { useData } from "../DataContext";

export function Profile(): JSX.Element {
  const navigate = useNavigate();
  const { user } = useData();
  const onHide = (): void => {
    navigate(`/`);
  };

  return (
    <Modal show onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Your Profile</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="container-fluid">
          <div className="flex-row-start m-2">
            <div className="bold">Your nostr npub:</div>
            <div className="ms-2">{nip19.npubEncode(user.publicKey)}</div>
          </div>
          <div className="flex-row-start m-2">
            <div className="bold">Your nostr nprofile:</div>
            <div className="ms-2">
              {nip19.nprofileEncode({ pubkey: user.publicKey })}
            </div>
          </div>
          <div className="flex-row-start m-2">
            <div className="bold">Your Public Key:</div>
            <div className="ms-2">{user.publicKey}</div>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}
