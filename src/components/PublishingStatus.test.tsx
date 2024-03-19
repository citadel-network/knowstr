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

test("Publishing Status is shown per relay", async () => {
  const [alice] = setup([ALICE]);
  const view = renderApp(alice());
  await typeNewNode(view, "New Note");
  userEvent.click(screen.getByLabelText("publishing status"));
  await screen.findByText("Publishing Status");
  screen.getByText("Relay wss://relay.damus.io/:");
  expect(
    screen.getAllByText(
      "100% of the last 3 events could be published on this relay"
    )
  ).toHaveLength(4);
});

test("Publishing Status is shown as failed", async () => {
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
  screen.getByText("Relay wss://relay.damus.io/:");
  screen.getByText("67% of the last 3 events could be published on this relay");
  screen.getByText(
    "The last event could not be published because: Error: too many requests"
  );
  screen.getByText("Relay wss://relay.snort.social/:");
  screen.getByText("Relay wss://nostr.wine/:");
  expect(
    screen.getAllByText(
      "0% of the last 3 events could be published on this relay"
    )
  ).toHaveLength(2);
  expect(
    screen.getAllByText(
      "The last event could not be published because: Error: paid relay"
    )
  ).toHaveLength(2);
  screen.getByText("Relay wss://nos.lol/:");
  screen.getByText(
    "100% of the last 3 events could be published on this relay"
  );
  screen.getByText(
    "The last event could not be published because: Error: too many requests"
  );
});
