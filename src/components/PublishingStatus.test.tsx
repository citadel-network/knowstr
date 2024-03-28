import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Event } from "nostr-tools";
import {
  setup,
  ALICE,
  renderApp,
  typeNewNode,
  renderWithTestData,
  TEST_RELAYS,
} from "../utils.test";
import { PublishingStatus } from "./PublishingStatus";
import { WorkspaceView } from "./Workspace";
import { MockRelayPool, mockRelayPool } from "../nostrMock.test";

test("Publishing Status", async () => {
  const [alice] = setup([ALICE]);
  const view = renderApp(alice());
  await typeNewNode(view, "New Note");
  userEvent.click(screen.getByLabelText("publishing status"));
  await screen.findByText("Publishing Status");
  expect(await screen.findAllByText("100%")).toHaveLength(4);
  userEvent.click(screen.getByText("Relay wss://relay.test.first.success/:"));
  screen.getByText("3 of the last 3 events have been published");
});

test("Details of Publishing Status", async () => {
  const [alice] = setup([ALICE], { relays: TEST_RELAYS });
  const utils = alice();
  const view = renderWithTestData(
    <>
      <PublishingStatus />
      <WorkspaceView />
    </>,
    {
      ...utils,
      relayPool: {
        ...mockRelayPool(),
        publish: (relays: Array<string>, event: Event): Promise<string>[] => {
          if (event.kind === 34751) {
            return [
              Promise.resolve("fulfilled"),
              Promise.reject(new Error("paid relay")),
              Promise.reject(new Error("too many requests")),
              Promise.resolve("fulfilled"),
            ];
          }
          return [
            Promise.resolve("fulfilled"),
            Promise.reject(new Error("paid relay")),
            Promise.resolve("fulfilled"),
            Promise.resolve("fulfilled"),
          ];
        },
      } as unknown as MockRelayPool,
      relays: TEST_RELAYS,
    }
  );
  await typeNewNode(view, "Hello World");
  userEvent.click(await screen.findByLabelText("publishing status"));
  await screen.findByText("Publishing Status");
  userEvent.click(screen.getByText("Relay wss://relay.test.first.success/:"));
  userEvent.click(screen.getByText("Relay wss://relay.test.fourth.success/:"));
  expect(
    screen.getAllByText("3 of the last 3 events have been published")
  ).toHaveLength(2);

  userEvent.click(screen.getByText("Relay wss://relay.test.third.rand/:"));
  screen.getByText("2 of the last 3 events have been published");
  screen.getByText("Last rejection reason: Error: too many requests");

  userEvent.click(
    await screen.findByText("Relay wss://relay.test.second.fail/:")
  );
  screen.getByText("0 of the last 3 events have been published");
  screen.getAllByText("Last rejection reason: Error: paid relay");
});
