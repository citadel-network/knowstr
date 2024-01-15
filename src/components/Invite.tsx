import React, { useState } from "react";
import Form from "react-bootstrap/Form";
import { QRCodeSVG } from "qrcode.react";
import { useLocation, useNavigate } from "react-router-dom";
import { Modal, Spinner } from "react-bootstrap";
import { QrReader } from "react-qr-reader";
import { useMediaQuery } from "react-responsive";
import ModalForm from "./ModalForm";
import { usePlanner, planEnsurePrivateContact } from "../planner";
import { useData } from "../DataContext";
import { LoadingSpinnerButton } from "./LoadingSpinnerButton";
import { IS_MOBILE } from "./responsive";

function QRCode({ url }: { url: string }): JSX.Element {
  return (
    <>
      <div style={{ justifyContent: "center" }}>
        <QRCodeSVG value={url} size={256} />
      </div>
      <Form.Control
        className="mt-2"
        value={url}
        readOnly
        size="sm"
        style={{ width: "100%" }}
      />
    </>
  );
}

function UserQRCode({ publicKey }: { publicKey: string }): JSX.Element {
  return (
    <QRCode url={`${window.location.origin}/invite?publicKey=${publicKey}`} />
  );
}

function urlFromInviteCode(inviteCode: string | undefined): string | undefined {
  if (!inviteCode) {
    return undefined;
  }
  const params = new URLSearchParams(new URL(inviteCode).searchParams);
  const publicKey = params.get("publicKey") || undefined;
  if (publicKey) {
    return `/invite?publicKey=${publicKey}`;
  }
  return undefined;
}

function ConfirmContactForm({
  handleSubmit,
  onHide,
  title,
  SubmitButton,
  contact,
}: {
  handleSubmit: (form: HTMLFormElement) => Promise<void>;
  onHide: () => void;
  title: string;
  contact: PublicKey;
  SubmitButton: () => JSX.Element;
}): JSX.Element {
  return (
    <ModalForm
      submit={handleSubmit}
      onHide={onHide}
      title={title}
      SubmitButton={SubmitButton}
      size="xl"
      hideAfterSubmit={false}
    >
      <ul className="list-unstyled mt-3">
        <li className="pb-3">
          <strong>Follow User:</strong> You can follow user{" "}
          <code className="bg-light p-1 rounded">{contact}</code> to see their
          Notes and updates.
        </li>
        <li className="pb-3">
          <strong>Public Profile:</strong> Your profile and posts are visible to
          all users in the network.
        </li>
        <li className="pb-3">
          <strong>Network Expansion:</strong> Gain insights into a broader
          community by viewing the public profiles and posts of users connected
          to those you follow, enhancing your understanding of the wider
          network.
        </li>
      </ul>
    </ModalForm>
  );
}

function WaitForInvite({ publicKey }: { publicKey: PublicKey }): JSX.Element {
  const navigate = useNavigate();
  const { user, contacts } = useData();
  const privateContact = contacts.get(publicKey);
  const isMobile = useMediaQuery(IS_MOBILE);

  // TODO: does this make any sense?
  const isFollowing = privateContact !== undefined;

  if (isFollowing) {
    return (
      <Modal show onHide={() => navigate("/")} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>You follow {publicKey}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="container-fluid">
            <div className="text-center">
              <span
                className={`iconsminds-yes success ${
                  isMobile ? "" : "massive-icon"
                }`}
              />
            </div>
          </div>
        </Modal.Body>
      </Modal>
    );
  }
  return (
    <Modal show onHide={() => navigate("/")} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Show QR Code to finish Connection</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="container-fluid">
          <div className="text-center">
            <UserQRCode publicKey={user.publicKey} />
          </div>
          <div className="mt-3">
            <div className="float-start ">
              <Spinner animation="border" />
              <span>&nbsp; Waiting for confirmation...</span>
            </div>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}

export function VCard(): JSX.Element {
  const navigate = useNavigate();
  const { user } = useData();
  const [showScan, setShowScan] = useState<boolean>(false);
  const [inviteUrl, setInviteUrl] = useState<string | undefined>(undefined);
  const onHide = (): void => {
    navigate(`/`);
  };

  const submit = (): Promise<void> => {
    if (!inviteUrl) {
      return Promise.resolve();
    }
    return Promise.resolve(navigate(inviteUrl));
  };

  const MyContact: JSX.Element = (
    <div className="container-fluid">
      <div className="align-center">
        <UserQRCode publicKey={user.publicKey} />
      </div>
    </div>
  );

  const ScanContact: JSX.Element = (
    <>
      <QrReader
        onResult={(result, error) => {
          if (result) {
            const url = urlFromInviteCode(result?.getText());
            setInviteUrl(url);
            return;
          }
          if (error) {
            // eslint-disable-next-line no-console
            console.warn(error);
          }
        }}
        containerStyle={{ height: "auto", width: "100%" }}
        videoContainerStyle={{
          height: "auto",
          width: "100%",
          paddingTop: "45%",
        }}
        videoStyle={{
          height: "auto",
          width: "60%",
          left: "20%",
          display: "inline",
        }}
        scanDelay={500}
        constraints={{
          facingMode: "environment",
        }}
      />
      {inviteUrl && (
        <div className="pt-3">
          <Form.Control
            readOnly
            name="inviteCode"
            type="text"
            placeholder={inviteUrl}
          />
        </div>
      )}
    </>
  );

  return (
    <Modal show onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>{showScan ? "Scan Contact" : "Your Contact"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="text-center">
          {!showScan && MyContact}
          {showScan && ScanContact}
        </div>
        <div className="mt-3">
          <div className={showScan ? "float-start" : "float-end"}>
            <button
              type="button"
              className="btn"
              onClick={() => setShowScan(!showScan)}
            >
              {showScan ? "Your Contact" : "Scan Contact"}
            </button>
          </div>
          <div className="float-end">
            {showScan && (
              <LoadingSpinnerButton
                onClick={submit}
                className="btn btn-primary"
              >
                Invite
              </LoadingSpinnerButton>
            )}
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}

function Invite(): JSX.Element {
  const { createPlan, executePlan } = usePlanner();
  const navigate = useNavigate();
  const { contacts } = useData();

  const { search } = useLocation();
  const params = new URLSearchParams(search);

  const rawPublicKey = params.get("publicKey");
  const publicKey = rawPublicKey ? (rawPublicKey as PublicKey) : undefined;

  if (!publicKey) {
    return (
      <Modal
        show
        onHide={() => {
          navigate("/");
        }}
      >
        <Modal.Header closeButton>
          <Modal.Title>Invitation Key not valid</Modal.Title>
        </Modal.Header>
      </Modal>
    );
  }
  const privateContact = contacts.get(publicKey);

  if (privateContact) {
    return <WaitForInvite publicKey={publicKey} />;
  }
  const onHide = (): void => navigate(`/`);
  const handleSubmit = async (): Promise<void> => {
    await executePlan(planEnsurePrivateContact(createPlan(), publicKey));
  };
  const SubmitButton = (): JSX.Element => (
    <LoadingSpinnerButton className="btn btn-primary" type="submit">
      Follow
    </LoadingSpinnerButton>
  );

  return (
    <ConfirmContactForm
      handleSubmit={handleSubmit}
      onHide={onHide}
      title="Follow User?"
      contact={publicKey}
      SubmitButton={SubmitButton}
    />
  );
}

export default Invite;
