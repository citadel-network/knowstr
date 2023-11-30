import { render, screen } from "@testing-library/react";
import React from "react";
import { Route, Routes, BrowserRouter } from "react-router-dom";
import { getPublicKey, nip06, nip19 } from "nostr-tools";
import { SignUp } from "./SignUp";

test("create nostr login data", () => {
  render(
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SignUp />} />
      </Routes>
    </BrowserRouter>
  );

  const mnemonic = (screen.getByLabelText("Mnemonic") as HTMLFormElement).value;

  const publicKey = (screen.getByLabelText("Public Key") as HTMLFormElement)
    .value;
  const privateKey = (screen.getByLabelText("Private Key") as HTMLFormElement)
    .value;

  const privateKeyFromMnemonic = nip06.privateKeyFromSeedWords(mnemonic);

  expect(privateKey).toEqual(nip19.nsecEncode(privateKeyFromMnemonic));
  expect(publicKey).toEqual(
    nip19.npubEncode(getPublicKey(privateKeyFromMnemonic))
  );
});
