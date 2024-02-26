import React from "react";
import { useNavigate } from "react-router-dom";
import { InputGroup, Modal } from "react-bootstrap";
import { nip19 } from "nostr-tools";
import { useData } from "../DataContext";
import { FormControlWrapper } from "./FormControlWrapper";
import { Button } from "./Ui";

type UserPublicIdentifierProps = {
  identifierName: string;
  identifier: string;
  copyToClipboard?: () => void;
};

function UserPublicIdentifier({
  identifierName,
  identifier,
  copyToClipboard,
}: UserPublicIdentifierProps): JSX.Element {
  return (
    <div className="flex-row-start m-2 align-items-center">
      <div className="bold w-25">Your nostr {identifierName}:</div>
      <InputGroup>
        <div style={{ position: "relative", flexGrow: 1, maxWidth: "40rem" }}>
          <FormControlWrapper
            aria-label={identifierName}
            defaultValue={identifier}
            disabled
            className="p-2 btn-borderless background-transparent font-size-medium"
          />
          <div
            style={{
              position: "absolute",
              right: "2px",
              top: "10%",
            }}
          >
            <Button
              className="btn-borderless background-white"
              onClick={copyToClipboard}
            >
              <span className="iconsminds-files" />
            </Button>
          </div>
        </div>
      </InputGroup>
    </div>
  );
}

export function Profile(): JSX.Element {
  const navigate = useNavigate();
  const { user } = useData();
  const onHide = (): void => {
    navigate("/");
  };
  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text);
  };
  const npub = nip19.npubEncode(user.publicKey);
  const nprofile = nip19.nprofileEncode({ pubkey: user.publicKey });

  return (
    <Modal show onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Your Profile</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="container-fluid">
          <UserPublicIdentifier
            identifierName="npub"
            identifier={npub as string}
            copyToClipboard={() => {
              copyToClipboard(npub);
            }}
          />
          <UserPublicIdentifier
            identifierName="nprofile"
            identifier={nprofile as string}
            copyToClipboard={() => {
              copyToClipboard(nprofile);
            }}
          />
        </div>
      </Modal.Body>
    </Modal>
  );
}
