import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Event } from "nostr-tools";
import { ALICE, setup, renderApp } from "../utils.test";
import { DEFAULT_RELAYS, KIND_RELAY_METADATA_EVENT } from "../nostr";

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
    screen.getByText("Set Nostr Relays");
    screen.getByDisplayValue("wss://relay.damus.io");
    screen.getByDisplayValue("wss://relay.snort.social");
    screen.getByDisplayValue("wss://nos.lol");
    screen.getByDisplayValue("wss://nostr.wine");
  });
  fireEvent.click(screen.getByLabelText(`remove wss://nos.lol`));
  screen.getByDisplayValue("wss://nostr.wine");
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() =>
    expect(
      relayPool.getEvents().filter(filterRelayMetadataEvents)
    ).toHaveLength(1)
  );
  const tags = relayTags(
    DEFAULT_RELAYS.filter((r) => r.url !== "wss://nos.lol") as unknown as Relays
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
    screen.getByText("Set Nostr Relays");
    screen.getByDisplayValue("wss://relay.damus.io");
    screen.getByDisplayValue("wss://relay.snort.social");
    screen.getByDisplayValue("wss://nos.lol");
    screen.getByDisplayValue("wss://nostr.wine");
  });
  fireEvent.click(screen.getByLabelText(`edit relay wss://nostr.wine`));
  const inputRelay = await screen.findByDisplayValue("wss://nostr.wine");
  userEvent.type(inputRelay, ".edited");

  // undo edit
  fireEvent.click(screen.getByLabelText("undo edit relay"));
  const inputRelaySecond = await screen.findByDisplayValue("wss://nostr.wine");

  fireEvent.click(screen.getByLabelText(`edit relay wss://nostr.wine`));
  userEvent.type(inputRelaySecond, ".second.edit");
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
    DEFAULT_RELAYS.map((r) =>
      r.url === "wss://nostr.wine"
        ? { ...r, url: "wss://nostr.wine.second.edit" }
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
