import React from "react";
import { screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import {
  renderWithTestData,
  renderApp,
  fillAndSubmitInviteForm,
  ALICE,
  BOB,
  BOB_PUBLIC_KEY,
  waitForLoadingToBeNull,
  setup,
  addContact,
} from "../utils.test";
import Invite from "./Invite";
import { NavBar } from "./Navbar";
import { createEncryption } from "../encryption";
import { mockRelayPool, MockRelayPool } from "../nostrMock.test";

beforeAll(() => {
  // eslint-disable-next-line functional/immutable-data
  Object.defineProperty(global.navigator, "mediaDevices", {
    value: {
      getUserMedia: jest.fn(async () => {
        return new Promise<void>((resolve) => {
          resolve();
        });
      }),
    },
  });
  // eslint-disable-next-line functional/immutable-data
  Object.defineProperty(global.HTMLMediaElement.prototype, "muted", {
    get: (): boolean => true,
  });
  // eslint-disable-next-line functional/immutable-data
  Object.defineProperty(global.HTMLMediaElement.prototype, "play", {
    get: async () => {
      return Promise.resolve();
    },
  });
});

it("displays error messages", async () => {
  const relayPool = {
    ...mockRelayPool(),
    publish: (): Promise<void> => {
      throw new Error("Alice is not allowed");
    },
  } as unknown as MockRelayPool;

  renderWithTestData(<Invite />, {
    relayPool,
    initialRoute: `/invite?eosAccountName=bob&publicKey=${BOB_PUBLIC_KEY}`,
  });

  await fillAndSubmitInviteForm();
  await screen.findByText("Alice is not allowed");
});

it("QR Code", async () => {
  renderApp({});
  await waitFor(() => {
    fireEvent.click(screen.getByLabelText("open menu"));
    const inviteBtn = screen.getByLabelText("invite user");
    fireEvent.click(inviteBtn);
  });
  screen.getByDisplayValue(
    `http://localhost/invite?publicKey=${ALICE.publicKey}`
  );
});

test("notification appears if and only if process is not finished", async () => {
  const encryption = createEncryption();
  // alice invites Bob
  const utils = renderApp({
    initialRoute: `/invite?publicKey=${BOB_PUBLIC_KEY}`,
    encryption,
  });

  await fillAndSubmitInviteForm();
  // alice sees notification, clicks on it, and is directed to wait for screen
  await screen.findByText("1");
  await waitFor(() => {
    fireEvent.click(screen.getByLabelText("notification-center"));
  });
  fireEvent.click(screen.getByText("Finish Connection"));
  await screen.findByText("Waiting for confirmation...");
  screen.getByText("Show QR Code to finish Connection");

  // bob invites alice
  cleanup();
  renderApp({
    ...utils,
    initialRoute: `/invite?publicKey=${ALICE.publicKey}`,
    user: BOB,
  });
  // bob invites alice
  await fillAndSubmitInviteForm();
  // Wait until view is finished loading to avoid memory leak
  await waitForLoadingToBeNull();

  // alice sees success screen and notification disappears
  cleanup();
  renderApp({
    ...utils,
    initialRoute: `/invite?publicKey=${BOB.publicKey}`,
  });
  // Wait until view is finished loading to avoid memory leak
  await waitForLoadingToBeNull();
  await screen.findByText("You are connected");
  // close modal view
  fireEvent.click(screen.getByText("Close"));
  expect(screen.queryByLabelText("notification-center")).toBeNull();
});

test("notification-center lists all unfinished connections", async () => {
  const [alice, bob] = setup([ALICE, BOB]);
  await addContact(alice, BOB.publicKey);
  renderWithTestData(<NavBar logout={jest.fn()} />, await alice());
  fireEvent.click(await screen.findByLabelText("notification-center"));
  screen.getByText("Finish Connection");
  fireEvent.click(await screen.findByLabelText("notification-center"));
  // Bob connects to Alice
  await addContact(bob, ALICE.publicKey);
  cleanup();

  renderWithTestData(<NavBar logout={jest.fn()} />, await alice());
  expect(screen.queryByLabelText("notification-center")).toBeNull();
});

test("invite an already existing user leads to waitFor screen", async () => {
  const [alice] = setup([ALICE]);
  await addContact(alice, BOB.publicKey);

  renderWithTestData(<Invite />, {
    ...(await alice()),
    initialRoute: `/invite?publicKey=${BOB_PUBLIC_KEY}`,
  });
  await screen.findByText("Show QR Code to finish Connection");
});
