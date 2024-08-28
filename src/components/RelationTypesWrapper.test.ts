import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Event } from "nostr-tools";
import { KIND_RELATION_TYPES } from "../nostr";
import { ALICE, setup, renderApp } from "../utils.test";

const filterRelationTypesEvents = (event: Event): boolean =>
  event.kind === KIND_RELATION_TYPES;

test("Edit a Relation Type Label", async () => {
  const [alice] = setup([ALICE]);
  const { relayPool } = renderApp({
    ...alice(),
    initialRoute: `/relationTypes`,
  });
  await screen.findByText("Edit Relation Types");
  fireEvent.click(screen.getByLabelText("edit relationType"));
  await userEvent.keyboard("my new RelationType");
  fireEvent.click(screen.getByLabelText("save"));
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() =>
    expect(
      relayPool.getEvents().filter(filterRelationTypesEvents)
    ).toHaveLength(1)
  );
  const event = relayPool.getEvents().filter(filterRelationTypesEvents)[0];
  expect(event).toEqual(
    expect.objectContaining({
      kind: 11076,
      pubkey:
        "f0289b28573a7c9bb169f43102b26259b7a4b758aca66ea3ac8cd0fe516a3758",
      tags: [],
      content: JSON.stringify({
        "": { c: "#027d86", l: "my new RelationType" },
      }),
    })
  );
});

test("Edit color of a Relation Type", async () => {
  const [alice] = setup([ALICE]);
  const { relayPool } = renderApp({
    ...alice(),
    initialRoute: `/relationTypes`,
  });
  await screen.findByText("Edit Relation Types");
  fireEvent.click(screen.getByLabelText("edit color of relationType"));
  const newColorElement = await screen.findByTitle("#9c27b0");
  fireEvent.click(newColorElement);
  expect(screen.queryByTitle("#027d86")).toBeNull();
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() =>
    expect(
      relayPool.getEvents().filter(filterRelationTypesEvents)
    ).toHaveLength(1)
  );
  const event = relayPool.getEvents().filter(filterRelationTypesEvents)[0];
  expect(event).toEqual(
    expect.objectContaining({
      kind: 11076,
      pubkey:
        "f0289b28573a7c9bb169f43102b26259b7a4b758aca66ea3ac8cd0fe516a3758",
      tags: [],
      content: JSON.stringify({ "": { c: "#9c27b0", l: "" } }),
    })
  );
});

test("Add a new Relation Type", async () => {
  const [alice] = setup([ALICE]);
  const { relayPool } = renderApp({
    ...alice(),
    initialRoute: `/relationTypes`,
  });
  await screen.findByText("Edit Relation Types");
  fireEvent.click(screen.getByLabelText("color of new relationType"));
  fireEvent.click(await screen.findByTitle("#9c27b0"));
  await userEvent.keyboard("new RelationType");
  fireEvent.click(screen.getByLabelText("save new relationType"));
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() =>
    expect(
      relayPool.getEvents().filter(filterRelationTypesEvents)
    ).toHaveLength(1)
  );
  const event = relayPool.getEvents().filter(filterRelationTypesEvents)[0];
  const eventContent = JSON.parse(event.content);
  const relationTypeId =
    Object.keys(eventContent).find((key) => key !== "") || "";
  expect(event).toEqual(
    expect.objectContaining({
      kind: 11076,
      pubkey:
        "f0289b28573a7c9bb169f43102b26259b7a4b758aca66ea3ac8cd0fe516a3758",
      tags: [],
      content: JSON.stringify({
        "": { c: "#027d86", l: "" },
        [relationTypeId]: { c: "#9c27b0", l: "new RelationType" },
      }),
    })
  );
});
