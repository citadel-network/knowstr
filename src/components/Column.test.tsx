import React from "react";
import { List, Map } from "immutable";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { DragDropContext } from "react-beautiful-dnd";
import userEvent from "@testing-library/user-event";
import {
  renderKnowledgeApp,
  createDefaultKnowledgeTestData,
  TEST_WORKSPACE_ID,
  ALICE,
  setup,
  renderWithTestData,
  expectTextContent,
  commitAll,
  renderApp,
  typeNewNode,
  matchSplitText,
} from "../utils.test";
import {
  newNode,
  bulkAddRelations,
  addRelationToRelations,
} from "../connections";
import { getNode, newDB, newRepo } from "../knowledge";
import { execute } from "../executor";
import { createPlan, planSetKnowledgeData, planUpsertNode } from "../planner";
import { WorkspaceColumnView } from "./WorkspaceColumn";
import { TemporaryViewProvider } from "./TemporaryViewContext";
import { updateNode, ViewContextProvider } from "../ViewContext";
import { compareKnowledgeDB } from "../knowledgeEvents";

test("Scroll position is stored in localStorage", async () => {
  const knowledgeDB = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);
  const note = newRepo(newNode("My first note", "NOTE"), "note-id");
  const secondNote = newRepo(
    newNode("My second note", "NOTE"),
    "second-note-id"
  );
  const thirdNote = newRepo(newNode("My third note", "NOTE"), "third-note-id");
  const fourthNote = newRepo(
    newNode("My fourth note", "NOTE"),
    "fourth-note-id"
  );
  const fifthNote = newRepo(newNode("My fifth note", "NOTE"), "fifth-note-id");
  const topic = newRepo(
    bulkAddRelations(
      newNode("My first topic", "TOPIC"),
      [note.id, secondNote.id, thirdNote.id, fourthNote.id, fifthNote.id],
      "RELEVANCE"
    ),
    "topic-id"
  );
  const nodes = Map<Repo>({
    [note.id]: note,
    [secondNote.id]: secondNote,
    [thirdNote.id]: thirdNote,
    [fourthNote.id]: fourthNote,
    [fifthNote.id]: fifthNote,
    [topic.id]: topic,
  });
  const addToWorkspace = updateNode(
    knowledgeDB.repos.merge(nodes),
    knowledgeDB.views,
    { root: TEST_WORKSPACE_ID, indexStack: List<number>() },
    (workspace, ctx) =>
      addRelationToRelations(workspace, topic.id, ctx.view.relationType)
  );
  const { fileStore } = await renderKnowledgeApp({
    ...knowledgeDB,
    ...addToWorkspace,
  });
  const nodesList = screen.getByLabelText("related to", {
    exact: false,
  });
  nodes
    .remove(topic.id)
    .toArray()
    .map((node, i) =>
      // each element is of heigth 100px, beginning at height 100px. jest doesn't render this, so we have to define these properties manually
      Object.defineProperty(
        // eslint-disable-next-line testing-library/no-node-access
        nodesList.querySelector<HTMLDivElement>(
          `[id='my-first-workspace-id:0:${i}']`
        ),
        "offsetTop",
        { value: i * 100 }
      )
    );

  // trigger useEffect and therefore re-calculating topbordermap by clicking on increase width button
  fireEvent.click(screen.getByLabelText("increase width"));
  fireEvent.scroll(nodesList, { target: { scrollTop: 250 } });
  await waitFor(() => expect(fileStore.getLocalStorageData().size).toBe(1));
  await waitFor(() =>
    expect(
      fileStore.getLocalStorageData().get("my-first-workspace-id:0")
    ).toEqual('"my-first-workspace-id:0:2"')
  );
  fireEvent.scroll(nodesList, { target: { scrollTop: 305 } });
  await waitFor(() =>
    expect(
      fileStore.getLocalStorageData().get("my-first-workspace-id:0")
    ).toEqual('"my-first-workspace-id:0:3"')
  );
  fireEvent.scroll(nodesList, { target: { scrollTop: 389 } });
  await waitFor(() =>
    expect(
      fileStore.getLocalStorageData().get("my-first-workspace-id:0")
    ).toEqual('"my-first-workspace-id:0:3"')
  );
  fireEvent.scroll(nodesList, { target: { scrollTop: 391 } });
  await waitFor(() =>
    expect(
      fileStore.getLocalStorageData().get("my-first-workspace-id:0")
    ).toEqual('"my-first-workspace-id:0:4"')
  );
  fireEvent.scroll(nodesList, { target: { scrollTop: 105 } });
  await waitFor(() =>
    expect(
      fileStore.getLocalStorageData().get("my-first-workspace-id:0")
    ).toEqual('"my-first-workspace-id:0:1"')
  );
  fireEvent.scroll(nodesList, { target: { scrollTop: 0 } });
  await waitFor(() =>
    expect(
      fileStore.getLocalStorageData().get("my-first-workspace-id:0")
    ).toEqual('"my-first-workspace-id:0:0"')
  );
  const closeButton = screen.getByLabelText("close");
  fireEvent.click(closeButton);
  await waitFor(() =>
    expect(
      fileStore.getLocalStorageData().get("my-first-workspace-id:0")
    ).toBeUndefined()
  );
});

test("Multiple connections to same node", async () => {
  const [alice] = setup([ALICE]);
  const java = newNode("Java", alice().user.publicKey);
  await execute({
    ...alice(),
    plan: planUpsertNode(createPlan(alice()), java),
  });

  const view = renderApp(alice());
  await typeNewNode(view, "Programming Languages");
  const searchButton = screen.getByLabelText(
    "search and attach to Programming Languages"
  );
  fireEvent.click(searchButton);

  const searchInput = await screen.findByLabelText("search input");
  userEvent.type(searchInput, "Jav");
  userEvent.click(screen.getByText(matchSplitText("Java")));

  fireEvent.click(searchButton);
  const searchInput2 = await screen.findByLabelText("search input");
  userEvent.type(searchInput2, "Jav");
  userEvent.click(screen.getAllByText(matchSplitText("Java"))[1]);

  expectTextContent(
    await screen.findByLabelText("related to Programming Languages"),
    ["Java", "Java", " Referenced By (1)"]
  );
});
