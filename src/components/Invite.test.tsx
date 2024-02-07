import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { Event } from "nostr-tools";
import {
  renderWithTestData,
  renderApp,
  ALICE,
  BOB,
  BOB_PUBLIC_KEY,
  setup,
  addContact,
} from "../utils.test";
import Invite from "./Invite";
import { KIND_CONTACTLIST } from "../nostr";

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

const filterContactListEvents = (event: Event): boolean =>
  event.kind === KIND_CONTACTLIST;

test("Add Contact sends nip-02 event", async () => {
  const [alice] = setup([ALICE]);
  const { relayPool } = renderApp({
    ...alice(),
    initialRoute: `/invite?publicKey=${BOB_PUBLIC_KEY}`,
  });
  await waitFor(() => {
    fireEvent.click(screen.getByText("Follow"));
  });

  // An Event gets published on nostr
  await waitFor(() =>
    expect(relayPool.getEvents().filter(filterContactListEvents)).toHaveLength(
      1
    )
  );
  const event = relayPool.getEvents().filter(filterContactListEvents)[0];
  expect(event).toEqual(
    expect.objectContaining({
      kind: 3,
      pubkey: `${ALICE.publicKey}`,
      tags: [["p", `${BOB.publicKey}`]],
      content: "",
    })
  );
});
