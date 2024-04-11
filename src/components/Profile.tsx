import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { InputGroup, Modal, Form } from "react-bootstrap";
import { nip05, nip19 } from "nostr-tools";
import QRCode from "react-qr-code";
import { useData } from "../DataContext";
import { FormControlWrapper } from "./FormControlWrapper";
import { Button } from "./Ui";
import { planUpdateNip05Identifier, usePlanner } from "../planner";
import { nip05Regex, pasteFromClipboard } from "./Follow";
import ErrorMessage from "./ErrorMessage";

type Identifier = "none" | "npub" | "nprofile" | "invite";

type UserPublicIdentifierProps = {
  identifierName: string;
  identifier: string;
  copyToClipboard: () => void;
  showCopiedSuccess: boolean;
  toggleQrCode: () => void;
  isQRToggled: boolean;
};

function UserPublicIdentifier({
  identifierName,
  identifier,
  copyToClipboard,
  showCopiedSuccess,
  toggleQrCode,
  isQRToggled,
}: UserPublicIdentifierProps): JSX.Element {
  return (
    <div className="flex-row-start m-2 align-items-center">
      <div className="bold w-25">
        {identifierName === "invite"
          ? "Your Knowstr Invite Link"
          : `Your nostr ${identifierName}:`}
      </div>
      <InputGroup>
        <div style={{ position: "relative", flexGrow: 1, maxWidth: "42rem" }}>
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
              <span
                className={
                  showCopiedSuccess ? "iconsminds-yes" : "iconsminds-files"
                }
              />
            </Button>
            <Button
              className={`btn btn-borderless ${
                isQRToggled ? "background-dark" : "background-white"
              }`}
              onClick={toggleQrCode}
            >
              <span className="iconsminds-qr-code" />
            </Button>
          </div>
        </div>
      </InputGroup>
    </div>
  );
}

function UpdateNip05Identifier(): JSX.Element {
  const { user } = useData();
  const { createPlan, executePlan } = usePlanner();
  const [input, setInput] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const changedInput = e.target.value;
    if (changedInput === input) {
      return;
    }
    setInput(!changedInput ? undefined : changedInput);
  };

  const onSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    if (!input || !nip05Regex.test(input)) {
      setError("Invalid nip-05 identifier");
      return;
    }
    const profile = await nip05.queryProfile(input);
    const publicKeyFoundOnDomain =
      profile !== null ? (profile.pubkey as PublicKey) : undefined;
    if (!publicKeyFoundOnDomain) {
      setError("This nip-05 identifier is not registered");
      return;
    }
    if (publicKeyFoundOnDomain !== user.publicKey) {
      setError("This nip-05 identifier is not registered to your PublicKey");
      return;
    }
    await executePlan(planUpdateNip05Identifier(createPlan(), input));
  };

  const inputElementAriaLabel = "update nip05 identifier";

  return (
    <Form onSubmit={onSubmit}>
      <div className="d-flex m-2 align-items-center">
        <InputGroup>
          <div style={{ position: "relative", flexGrow: 1 }}>
            <FormControlWrapper
              aria-label={inputElementAriaLabel}
              defaultValue=""
              onChange={onChange}
              placeholder="Enter nostr address"
              className="p-2 w-100"
            />
            <div
              style={{
                position: "absolute",
                right: "10px",
                top: "15%",
              }}
            >
              <Button
                className="btn-borderless background-transparent"
                onClick={() =>
                  pasteFromClipboard(inputElementAriaLabel, setInput)
                }
              >
                <span className="iconsminds-file-clipboard" />
              </Button>
            </div>
          </div>
        </InputGroup>
        <div className="ms-4">
          <Button
            type="submit"
            className="btn btn-primary"
            ariaLabel="submit nip05 identifier"
            disabled={!input}
          >
            Submit
          </Button>
        </div>
      </div>
      <div className="m-2">
        <ErrorMessage error={error} setError={setError} />
      </div>
    </Form>
  );
}

export function Profile(): JSX.Element {
  const navigate = useNavigate();
  const { user } = useData();
  const [copied, setCopied] = useState<Identifier>("none");
  const [qrCodeIdentifier, setQrCodeIdentifier] = useState<Identifier>("none");

  const onHide = (): void => {
    navigate("/");
  };

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text);
  };
  const npub = nip19.npubEncode(user.publicKey);
  const nprofile = nip19.nprofileEncode({ pubkey: user.publicKey });
  const inviteLink = `${window.location.origin}/follow?publicKey=${user.publicKey}`;

  const encodeForQR = (identifier: string): string => {
    switch (identifier) {
      case "npub":
        return encodeURIComponent(npub);
      case "nprofile":
        return encodeURIComponent(nprofile);
      case "invite":
        return inviteLink;
      default:
        return "";
    }
  };

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
              if (copied !== "npub") {
                setCopied("npub");
              }
            }}
            showCopiedSuccess={copied === "npub"}
            toggleQrCode={() => {
              if (qrCodeIdentifier === "npub") {
                setQrCodeIdentifier("none");
              } else {
                setQrCodeIdentifier("npub");
              }
            }}
            isQRToggled={qrCodeIdentifier === "npub"}
          />
          <UserPublicIdentifier
            identifierName="nprofile"
            identifier={nprofile as string}
            copyToClipboard={() => {
              copyToClipboard(nprofile);
              if (copied !== "nprofile") {
                setCopied("nprofile");
              }
            }}
            showCopiedSuccess={copied === "nprofile"}
            toggleQrCode={() => {
              if (qrCodeIdentifier === "nprofile") {
                setQrCodeIdentifier("none");
              } else {
                setQrCodeIdentifier("nprofile");
              }
            }}
            isQRToggled={qrCodeIdentifier === "nprofile"}
          />

          <UserPublicIdentifier
            identifierName="invite"
            identifier={inviteLink}
            copyToClipboard={() => {
              copyToClipboard(inviteLink);
              if (copied !== "invite") {
                setCopied("invite");
              }
            }}
            showCopiedSuccess={copied === "invite"}
            toggleQrCode={() => {
              if (qrCodeIdentifier === "invite") {
                setQrCodeIdentifier("none");
              } else {
                setQrCodeIdentifier("invite");
              }
            }}
            isQRToggled={qrCodeIdentifier === "invite"}
          />
          {qrCodeIdentifier !== "none" && (
            <div className="flex-row-center m-2">
              <QRCode value={encodeForQR(qrCodeIdentifier)} level="M" />
            </div>
          )}
        </div>
        <UpdateNip05Identifier />
      </Modal.Body>
    </Modal>
  );
}
