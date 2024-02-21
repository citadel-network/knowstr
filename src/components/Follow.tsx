import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Form, Modal } from "react-bootstrap";
import { nip19, nip05 } from "nostr-tools";
import { usePlanner, planAddContact, planRemoveContact } from "../planner";
import { useData } from "../DataContext";
import { FormControlWrapper } from "./FormControlWrapper";
import { Button } from "./Ui";
import ErrorMessage from "./ErrorMessage";

async function decodeInput(
  input: string | undefined
): Promise<PublicKey | undefined> {
  if (!input) {
    return undefined;
  }
  try {
    const decodedInput = nip19.decode(input);
    const inputType = decodedInput.type;
    if (inputType === "npub") {
      return decodedInput.data as PublicKey;
    }
    if (inputType === "nprofile") {
      return decodedInput.data.pubkey as PublicKey;
    }
    // eslint-disable-next-line no-empty
  } catch (e) {}
  const publicKeyRegex = /^[a-fA-F0-9]{64}$/;
  if (publicKeyRegex.test(input)) {
    return input as PublicKey;
  }
  const nip05Regex = /^[a-z0-9-_.]+@[a-z0-9-_.]+\.[a-z0-9-_.]+$/i;
  if (nip05Regex.test(input)) {
    const profile = await nip05.queryProfile(input);
    return profile !== null ? (profile.pubkey as PublicKey) : undefined;
  }
  return undefined;
}

export function Follow(): JSX.Element {
  const navigate = useNavigate();
  const { contacts } = useData();
  const { createPlan, executePlan } = usePlanner();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const rawPublicKey = params.get("publicKey");
  const publicKey = rawPublicKey ? (rawPublicKey as PublicKey) : undefined;
  const [input, setInput] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const onHide = (): void => {
    navigate(`/`);
  };

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
    const decodedInput = await decodeInput(input);
    if (!decodedInput) {
      setError("Invalid publicKey, npub, nprofile or nip-05 identifier");
    } else {
      navigate(`/follow?publicKey=${decodedInput}`);
    }
  };

  if (!publicKey) {
    return (
      <Modal show onHide={onHide} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Find User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={onSubmit}>
            <div className="d-flex m-2 align-items-center">
              <FormControlWrapper
                aria-label="find user"
                defaultValue=""
                onChange={onChange}
                placeholder="Enter publicKey, npub or nprofile"
                className="p-2"
                style={{ flexGrow: 1 }}
              />
              <div className="ms-4">
                <Button
                  type="submit"
                  className="btn btn-primary"
                  ariaLabel="start search"
                  disabled={!input}
                >
                  Find
                </Button>
              </div>
            </div>
            <div className="m-2">
              <ErrorMessage error={error} setError={setError} />
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    );
  }

  const privateContact = contacts.get(publicKey);
  const isFollowing = privateContact !== undefined;

  const followContact = async (): Promise<void> => {
    await executePlan(planAddContact(createPlan(), publicKey));
    navigate(`/follow?publicKey=${publicKey}`);
  };

  const unfollowContact = async (): Promise<void> => {
    await executePlan(planRemoveContact(createPlan(), publicKey));
    navigate(`/follow?publicKey=${publicKey}`);
  };

  return (
    <Modal show onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>
          {isFollowing ? `You follow this User` : `Follow User`}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex m-2 align-items-center">
          <FormControlWrapper
            aria-label="user publicKey"
            value={publicKey}
            readOnly
            disabled
            className="p-2"
            style={{ flexGrow: 1 }}
          />
          <div className="ms-4">
            <Button
              className="btn btn-primary"
              ariaLabel="unfollow user"
              onClick={unfollowContact}
              disabled={!isFollowing}
              type="button"
            >
              <span className="simple-icon-user-unfollow d-block" />
            </Button>
          </div>
          <div className="ms-2">
            <Button
              className="btn btn-primary"
              ariaLabel="follow user"
              onClick={followContact}
              disabled={isFollowing}
              type="button"
            >
              <span className="simple-icon-user-follow d-block" />
            </Button>
          </div>
        </div>
        <div className="p-2">
          <Button
            onClick={() => {
              setInput(undefined);
              navigate(`/follow`);
            }}
            className="btn"
          >
            Back
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  );
}
