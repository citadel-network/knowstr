import React, { useEffect, useRef, useState } from "react";
import { Form, Modal } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { UnsignedEvent, getPublicKey, nip19 } from "nostr-tools";
// eslint-disable-next-line import/no-unresolved
import * as nip06 from "nostr-tools/nip06";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import {
  ErrorMessage,
  createSubmitHandler,
  Button,
  getWriteRelays,
} from "citadel-commons";
import { List } from "immutable";
import {
  isUserLoggedIn,
  useLogin,
  useLoginWithExtension,
} from "./NostrAuthContext";
import { useData } from "./DataContext";
import { Plan, planFallbackWorkspaceIfNecessary, usePlanner } from "./planner";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className="flex-row-space-between align-center mb-3">
        <Form.Group controlId="inputSeed" className="w-80">
          <ErrorMessage error={error} setError={setError} />
          <Form.Control
            type="password"
            placeholder="nsec, private key or mnemonic (12 words)"
            required
          />
        </Form.Group>
        <div className="float-end">
          {loading ? (
            <div aria-label="loading" className="spinner-border" />
          ) : (
            <Button type="submit">Continue</Button>
          )}
        </div>
      </div>
    </Form>
  );
}

function SignInWithExtension({
  setPublicKey,
}: {
  setPublicKey: (publicKey: PublicKey) => void;
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

  const getPublicKeyFromExtension = async (): Promise<
    PublicKey | undefined
  > => {
    try {
      return window.nostr.getPublicKey();
      // eslint-disable-next-line no-empty
    } catch {
      return undefined;
    }
  };

  const submit = async (): Promise<void> => {
    const publicKey = await getPublicKeyFromExtension();
    if (!publicKey) {
      throw new Error("No public key found in extension");
    }
    setPublicKey(publicKey);
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
      <div className="d-flex flex-column align-center">
        <div className="black-muted m-3">- OR -</div>
        <Form.Group controlId="signInWithExtension">
          <ErrorMessage error={error} setError={setError} />
          <div className="w-100">
            {loading ? (
              <div aria-label="loading" className="spinner-border" />
            ) : (
              <Button type="submit">Continue with Extension</Button>
            )}
          </div>
        </Form.Group>
        <div className="black-muted m-3">- OR -</div>
        <div>
          <Button
            className="btn btn-borderless underline mb-3"
            onClick={() => {
              navigate("/signup", {
                state: { referrer: pathname + search + hash },
              });
            }}
          >
            Create new Account
          </Button>
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
  const loginWithExtension = useLoginWithExtension();
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
  const signIn = async ({
    withExtension,
    key,
  }: {
    withExtension: boolean;
    key: string | PublicKey;
  }): Promise<void> => {
    const user = withExtension
      ? loginWithExtension(key as PublicKey)
      : login(key as string);
    const plan = planRewriteUnpublishedEvents(
      { ...planFallbackWorkspaceIfNecessary(createPlan()), user },
      publishEventsStatus.unsignedEvents
    );
    if (plan.publishEvents.size === 0) {
      onHide();
      return;
    }
    const results = await execute({
      plan,
      relayPool,
      relays: getWriteRelays(plan.relays),
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
        <SignInWithSeed
          setPrivateKey={(privateKey) =>
            signIn({ withExtension: false, key: privateKey })
          }
        />
        <SignInWithExtension
          setPublicKey={(publicKey) =>
            signIn({ withExtension: true, key: publicKey })
          }
        />
      </Modal.Body>
    </Modal>
  );
}

export function SignInMenuBtn(): JSX.Element | null {
  const { user, publishEventsStatus } = useData();
  const navigate = useNavigate();
  const isLoggedIn = isUserLoggedIn(user);
  if (isLoggedIn) {
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
