import React, { useEffect, useRef, useState } from "react";
import { Form, Modal } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { UnsignedEvent, getPublicKey, nip19 } from "nostr-tools";
// eslint-disable-next-line import/no-unresolved
import * as nip06 from "nostr-tools/nip06";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { ErrorMessage, createSubmitHandler, Button } from "citadel-commons";
import { List } from "immutable";
import { isUserLoggedIn, useLogin } from "./NostrAuthContext";
import { useData } from "./DataContext";
import { Plan, usePlanner } from "./planner";
import { UNAUTHENTICATED_USER_PK } from "./AppState";
import { execute } from "./executor";
import { useApis } from "./Apis";

/* eslint-disable no-empty */
function convertInputToPrivateKey(input: string): string | undefined {
  try {
    const { type, data } = nip19.decode(input);
    if (type !== "nsec") {
      return undefined;
    }
    return bytesToHex(data);
  } catch {}
  try {
    // Is this a seed phrase?
    return nip06.privateKeyFromSeedWords(input);
  } catch {}
  try {
    // Is this a private key?
    getPublicKey(hexToBytes(input));
    return input;
  } catch {}
  return undefined;
}
/* eslint-disable no-empty */

function SignInWithSeed({
  setPrivateKey,
}: {
  setPrivateKey: (privateKey: string) => void;
}): JSX.Element {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { pathname, search, hash } = new URL(window.location.href);

  const componentIsMounted = useRef(true);
  useEffect(() => {
    return () => {
      // eslint-disable-next-line functional/immutable-data
      componentIsMounted.current = false;
    };
  }, []);

  const submit = (form: HTMLFormElement): Promise<void> => {
    const seedPhrase = (
      form.elements.namedItem("inputSeed") as HTMLInputElement
    ).value;
    const privateKey = convertInputToPrivateKey(seedPhrase);
    if (!privateKey) {
      throw new Error("Input is not a valid nsec, private key or mnemonic");
    }
    setPrivateKey(privateKey);
    return Promise.resolve();
  };
  const onSubmit = createSubmitHandler({
    setLoading: (l) => {
      if (componentIsMounted.current) {
        setLoading(l);
      }
    },
    setError,
    submit,
  });

  return (
    <Form onSubmit={onSubmit}>
      <Form.Group controlId="inputSeed" className="mb-2">
        <Form.Label>Sign In</Form.Label>
        <ErrorMessage error={error} setError={setError} />
        <Form.Control
          type="password"
          placeholder="nsec, private key or mnemonic (12 words)"
          required
        />
      </Form.Group>
      <div>
        <Button
          className="btn btn-borderless underline"
          onClick={() => {
            navigate("/signup", {
              state: { referrer: pathname + search + hash },
            });
          }}
        >
          Create new Account
        </Button>
        <div className="float-end">
          {loading ? (
            <div aria-label="loading" className="spinner-border" />
          ) : (
            <Button type="submit">Login</Button>
          )}
        </div>
      </div>
    </Form>
  );
}

type LocationState = {
  referrer?: string;
};

function rewriteIDs(event: UnsignedEvent): UnsignedEvent {
  // TODO: This feels quite dangerous
  const replacedTags = event.tags.map((tag) =>
    tag.map((t) => t.replaceAll(UNAUTHENTICATED_USER_PK, event.pubkey))
  );
  return {
    ...event,
    content: event.content.replaceAll(UNAUTHENTICATED_USER_PK, event.pubkey),
    tags: replacedTags,
  };
}

function planRewriteUnpublishedEvents(
  plan: Plan,
  events: List<UnsignedEvent>
): Plan {
  const allEvents = plan.publishEvents.concat(events);
  const rewrittenEvents = allEvents.map((event) =>
    rewriteIDs({
      ...event,
      pubkey: plan.user.publicKey,
    })
  );
  return {
    ...plan,
    publishEvents: rewrittenEvents,
  };
}

export function SignInModal(): JSX.Element {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const { publishEventsStatus } = useData();
  const { relayPool, finalizeEvent } = useApis();
  const { createPlan, setPublishEvents } = usePlanner();
  const referrer =
    (location.state as LocationState | undefined)?.referrer || "/";
  const onHide = (): void => {
    navigate(referrer);
  };
  const setPrivateKey = async (pk: string): Promise<void> => {
    const user = login(pk);
    const plan = planRewriteUnpublishedEvents(
      { ...createPlan(), user },
      publishEventsStatus.unsignedEvents
    );
    if (plan.publishEventsStatus.unsignedEvents.size === 0) {
      onHide();
      return;
    }
    const results = await execute({
      plan,
      relayPool,
      relays: plan.relays.filter((r) => r.write === true),
      finalizeEvent,
    });
    setPublishEvents(() => {
      return {
        unsignedEvents: plan.publishEvents, // TODO: or better to empty it?
        results,
        isLoading: false,
      };
    });
    onHide();
  };
  return (
    <Modal show onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Login</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <SignInWithSeed setPrivateKey={setPrivateKey} />
      </Modal.Body>
    </Modal>
  );
}

export function SignInMenuBtn(): JSX.Element | null {
  const { user, publishEventsStatus } = useData();
  const navigate = useNavigate();
  if (isUserLoggedIn(user)) {
    return null;
  }
  const unsavedChanges = publishEventsStatus.unsignedEvents.size > 0;
  return (
    <Button
      ariaLabel="sign in"
      className="btn font-size-small"
      onClick={() => navigate("/signin")}
    >
      {unsavedChanges && <span style={{ color: "red" }}>Sign in to Save</span>}
      {!unsavedChanges && <span className="simple-icon-login" />}
    </Button>
  );
}
