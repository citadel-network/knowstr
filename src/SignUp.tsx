import React from "react";
import { Card, Form } from "react-bootstrap";
import { getPublicKey, nip19 } from "nostr-tools";
// eslint-disable-next-line import/no-unresolved
import * as nip06 from "nostr-tools/nip06";
import { Link, useLocation } from "react-router-dom";
import { hexToBytes } from "@noble/hashes/utils";
import { StandaloneCard } from "citadel-commons";

type LocationState = {
  referrer?: string;
};

export function SignUp(): JSX.Element {
  document.body.classList.add("background");
  const location = useLocation();
  const referrer =
    (location.state as LocationState | undefined)?.referrer || "/signin";

  const mnemonic = nip06.generateSeedWords();
  const pk = nip06.privateKeyFromSeedWords(mnemonic);
  const privateKey = hexToBytes(pk);

  const nsec = nip19.nsecEncode(privateKey);

  const publicKey = getPublicKey(privateKey);
  const npub = nip19.npubEncode(publicKey);

  return (
    <StandaloneCard>
      <Card.Title className="text-center">
        <h1>Secure your Private Key</h1>
      </Card.Title>
      <div>
        Your private key is essential for accessing your Account. If lost, you
        can&apos;t retrieve your Account; if compromised, your privacy is at
        risk. Write it down and store it in a secure place. Avoid digital
        storage to reduce hacking risks and never share it with anyone. Keeping
        your key safe ensures your privacy and access to your Account.
      </div>
      <div className="mt-4">
        <h3>Your Mnemonic (use this to login)</h3>
        <div>
          You can use this to login and as a backup to restore your Private Key
        </div>
        <Form.Control
          aria-label="Mnemonic"
          className="mt-2"
          value={mnemonic}
          readOnly
        />
      </div>
      <div className="mt-4">
        <h3>Your Private Key (alternative login)</h3>
        <Form.Control
          aria-label="Private Key"
          className="mt-2"
          value={nsec}
          readOnly
        />
      </div>
      <div className="mt-4">
        <h3>Your Public Key</h3>
        <Form.Control
          aria-label="Public Key"
          className="mt-2"
          value={npub}
          readOnly
        />
      </div>
      <div className="float-end mt-4">
        <div className="btn">
          <Link className="no-underline" to={referrer}>
            I created a backup of my key
          </Link>
        </div>
      </div>
    </StandaloneCard>
  );
}
