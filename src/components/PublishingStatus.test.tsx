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
  userEvent.click(screen.getByText("Relay wss://relay.damus.io/:"));
  screen.getByText("3 of the last 3 events have been published");
});

test("Details of Publishing Status", async () => {
  const [alice] = setup([ALICE]);
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
              Promise.reject(new Error("too many requests")),
              Promise.reject(new Error("paid relay")),
              Promise.resolve("fulfilled"),
              Promise.reject(new Error("paid relay")),
            ];
          }
          return [
            Promise.resolve("fulfilled"),
            Promise.reject(new Error("paid relay")),
            Promise.resolve("fulfilled"),
            Promise.reject(new Error("paid relay")),
          ];
        },
      } as unknown as MockRelayPool,
    }
  );
  await typeNewNode(view, "Hello World");

  userEvent.click(screen.getByLabelText("publishing status"));
  await screen.findByText("Publishing Status");
  userEvent.click(screen.getByText("Relay wss://relay.damus.io/:"));
  screen.getByText("2 of the last 3 events have been published");
  screen.getByText("Last rejection reason: Error: too many requests");
  userEvent.click(screen.getByText("Relay wss://relay.snort.social/:"));
  expect(
    screen.getAllByText("0 of the last 3 events have been published")
  ).toHaveLength(1);
  expect(
    screen.getAllByText("Last rejection reason: Error: paid relay")
  ).toHaveLength(1);
  userEvent.click(screen.getByText("Relay wss://nostr.wine/:"));
  expect(
    screen.getAllByText("0 of the last 3 events have been published")
  ).toHaveLength(2);
  expect(
    screen.getAllByText("Last rejection reason: Error: paid relay")
  ).toHaveLength(2);
  userEvent.click(screen.getByText("Relay wss://relay.snort.social/:"));
  expect(
    screen.getAllByText("0 of the last 3 events have been published")
  ).toHaveLength(1);
  expect(
    screen.getAllByText("Last rejection reason: Error: paid relay")
  ).toHaveLength(1);
  userEvent.click(screen.getByText("Relay wss://nos.lol/:"));
  screen.getByText("3 of the last 3 events have been published");
  screen.getByText("Last rejection reason: Error: too many requests");
});
