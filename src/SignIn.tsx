import React, { useEffect, useRef, useState } from "react";
import { Card, Form } from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getPublicKey, nip19 } from "nostr-tools";
// eslint-disable-next-line import/no-unresolved
import * as nip06 from "nostr-tools/nip06";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { Button, StandaloneCard } from "./components/Ui";
import { useLogin } from "./NostrAuthContext";
import createSubmitHandler from "./components/modalFormSubmitHandler";
import ErrorMessage from "./components/ErrorMessage";

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
        <Link to="/signup" className="btn btn-borderless underline">
          Create new Account
        </Link>
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

export function SignInFullScreen(): JSX.Element {
  const path = useLocation();
  const login = useLogin();
  const navigate = useNavigate();
  document.body.classList.add("background");
  return (
    <StandaloneCard>
      <div>
        <Card.Title className="text-center">
          <h1>Login</h1>
        </Card.Title>
        <SignInWithSeed
          setPrivateKey={(pk) => {
            login(pk);
            navigate(path.pathname === "/signin" ? "/" : path, {
              replace: true,
            });
          }}
        />
      </div>
    </StandaloneCard>
  );
}
