import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import {
  renderWithTestData,
  renderApp,
  fillAndSubmitInviteForm,
  ALICE,
  BOB,
  BOB_PUBLIC_KEY,
  setup,
  addContact,
} from "../utils.test";
import Invite from "./Invite";
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

test("follow an already followed user leads to success screen", async () => {
  const [alice] = setup([ALICE]);
  await addContact(alice, BOB.publicKey);

  renderWithTestData(<Invite />, {
    ...alice(),
    initialRoute: `/invite?publicKey=${BOB_PUBLIC_KEY}`,
  });
  await screen.findByText(`You follow ${BOB_PUBLIC_KEY}`);
});
