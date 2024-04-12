import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Event } from "nostr-tools";
import { ALICE, setup, renderApp, TEST_RELAYS } from "../utils.test";
import { KIND_RELAY_METADATA_EVENT } from "../nostr";

const filterRelayMetadataEvents = (event: Event): boolean =>
  event.kind === KIND_RELAY_METADATA_EVENT;

function relayTags(relays: Relays): string[][] {
  return relays.map((r) => ["r", r.url]);
}

test("Remove a Nostr Relay", async () => {
  const [alice] = setup([ALICE]);
  const { relayPool } = renderApp(alice());
  fireEvent.click(await screen.findByLabelText("open menu"));
  fireEvent.click(await screen.findByLabelText("edit relays"));
  await waitFor(() => {
    screen.getByText("Edit Nostr Relays");
    screen.getByDisplayValue("wss://relay.test.first.success/");
    screen.getByDisplayValue("wss://relay.test.second.fail/");
  });
  fireEvent.click(
    screen.getByLabelText("remove wss://relay.test.second.fail/")
  );
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() =>
    expect(
      relayPool.getEvents().filter(filterRelayMetadataEvents)
    ).toHaveLength(1)
  );
  const tags = relayTags(
    TEST_RELAYS.filter(
      (r) => r.url !== "wss://relay.test.second.fail/"
    ) as unknown as Relays
  );
  const event = relayPool.getEvents().filter(filterRelayMetadataEvents)[0];
  expect(event).toEqual(
    expect.objectContaining({
      kind: 10002,
      pubkey:
        "f0289b28573a7c9bb169f43102b26259b7a4b758aca66ea3ac8cd0fe516a3758",
      tags,
      content: "",
    })
  );
});

test("Edit an existing Nostr Relay", async () => {
  const [alice] = setup([ALICE]);
  const { relayPool } = renderApp(alice());
  fireEvent.click(await screen.findByLabelText("open menu"));
  fireEvent.click(await screen.findByLabelText("edit relays"));
  await waitFor(() => {
    screen.getByText("Edit Nostr Relays");
    screen.getByDisplayValue("wss://relay.test.first.success/");
    screen.getByDisplayValue("wss://relay.test.second.fail/");
  });
  fireEvent.click(
    screen.getByLabelText("edit relay wss://relay.test.second.fail/")
  );
  const inputRelay = await screen.findByDisplayValue(
    "wss://relay.test.second.fail/"
  );
  userEvent.type(inputRelay, ".edited");

  // undo edit
  fireEvent.click(screen.getByLabelText("undo edit relay"));
  const inputRelaySecond = await screen.findByDisplayValue(
    "wss://relay.test.second.fail/"
  );

  fireEvent.click(
    screen.getByLabelText("edit relay wss://relay.test.second.fail/")
  );
  userEvent.type(inputRelaySecond, "second.edit");
  fireEvent.click(screen.getByLabelText("save edit relay"));
  fireEvent.click(screen.getByText("Save"));

  // An Event gets published on nostr
  await waitFor(() =>
    expect(
      relayPool.getEvents().filter(filterRelayMetadataEvents)
    ).toHaveLength(1)
  );
  const event = relayPool.getEvents().filter(filterRelayMetadataEvents)[0];
  const tags = relayTags(
    TEST_RELAYS.map((r) =>
      r.url === "wss://relay.test.second.fail/"
        ? { ...r, url: "wss://relay.test.second.fail/second.edit" }
        : r
    ) as Relays
  );
  expect(event).toEqual(
    expect.objectContaining({
      kind: 10002,
      pubkey:
        "f0289b28573a7c9bb169f43102b26259b7a4b758aca66ea3ac8cd0fe516a3758",
      tags,
      content: "",
    })
  );
});

// TODO: demonstrate that knowledge db is reloaded when editing a relay
// TODO: test adding relay with knowledge data
