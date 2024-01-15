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
} from "../utils.test";
import { newNode, bulkAddRelations, addRelationToNode } from "../connections";
import { getNode, newDB, newRepo } from "../knowledge";
import { execute } from "../executor";
import { createPlan, planSetKnowledgeData } from "../planner";
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
      addRelationToNode(workspace, topic.id, ctx.view.relationType)
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
  // w => [pl] => [c, c]
  const repos = Map<string, Repo>({
    w: newRepo(
      addRelationToNode(
        newNode("Workspace:#FF0000", "WORKSPACE"),
        "pl",
        "RELEVANCE"
      ),
      "w"
    ),
    pl: newRepo(
      bulkAddRelations(
        newNode("Programming Languages", "TOPIC"),
        ["c", "c"],
        "RELEVANCE"
      ),
      "pl"
    ),
    c: newRepo(newNode("C", "TOPIC"), "c"),
  });
  await execute({
    ...alice(),
    plan: planSetKnowledgeData(
      createPlan(alice()),
      compareKnowledgeDB(
        newDB(),
        commitAll({
          repos,
          views: Map<string, View>(),
          activeWorkspace: "w",
        })
      )
    ),
  });
  renderWithTestData(
    <ViewContextProvider root="w" indices={List([0])}>
      <TemporaryViewProvider>
        <DragDropContext onDragEnd={jest.fn()}>
          <WorkspaceColumnView />
        </DragDropContext>
      </TemporaryViewProvider>
    </ViewContextProvider>,
    alice()
  );
  expectTextContent(
    await screen.findByLabelText("related to Programming Languages [main]"),
    ["C00", "C00", " Referenced By (1)"]
  );
});

test("Summary is shown in innerNodes if there is a summary relation", async () => {
  const knowledgeDB = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);
  const note = newRepo(newNode("My first note", "NOTE"), "note-id");
  const summary = newRepo(newNode("My summary", "NOTE"), "summary-id");
  const topic = newRepo(newNode("My first topic", "TOPIC"), "topic-id");
  const nodes = Map<Repo>({
    [note.id]: newRepo(
      addRelationToNode(getNode(note), summary.id, "SUMMARY"),
      note.id
    ),
    [summary.id]: summary,
    [topic.id]: newRepo(
      addRelationToNode(getNode(topic), note.id, "RELEVANCE"),
      topic.id
    ),
  });
  const addNoteToWorkspace = updateNode(
    knowledgeDB.repos.merge(nodes),
    knowledgeDB.views,
    { root: TEST_WORKSPACE_ID, indexStack: List<number>() },
    (workspace, ctx) =>
      addRelationToNode(workspace, topic.id, ctx.view.relationType)
  );
  await renderKnowledgeApp({
    ...knowledgeDB,
    ...addNoteToWorkspace,
  });
  await screen.findByText("My first topic");
  fireEvent.click(screen.getByText("My summary"));
});

test("Summarized note is shown in Column when summary is opened", async () => {
  const knowledgeDB = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);
  const note = newRepo(newNode("My first note", "NOTE"), "note-id");
  const summary = newRepo(newNode("My summary", "NOTE"), "summary-id");

  const nodes = Map<Repo>({
    [note.id]: newRepo(
      addRelationToNode(getNode(note), summary.id, "SUMMARY"),
      note.id
    ),
    [summary.id]: summary,
  });
  const addNoteToWorkspace = updateNode(
    knowledgeDB.repos.merge(nodes),
    knowledgeDB.views,
    { root: TEST_WORKSPACE_ID, indexStack: List<number>() },
    (workspace) => workspace
  );
  await renderKnowledgeApp({
    ...knowledgeDB,
    ...addNoteToWorkspace,
  });
  const searchButton = screen.getByLabelText("search");
  fireEvent.click(searchButton);
  const searchInput = await screen.findByLabelText("search input");
  userEvent.type(searchInput, "My first");
  fireEvent.click(await screen.findByText("My summary"));
  await screen.findByText("My first note");
  expect(screen.queryByText("My summary")).toBeNull();
});

test("Can't show or add Summaries on Titles", async () => {
  const knowledgeDB = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);
  const title = newRepo(newNode("My first title", "TITLE"), "title-id");
  const note = newRepo(newNode("My first note", "NOTE"), "note-id");
  const nodes = Map<Repo>({
    [title.id]: newRepo(
      addRelationToNode(getNode(title), note.id, "RELEVANCE"),
      title.id
    ),
    [note.id]: note,
  });
  const addNoteToWorkspace = updateNode(
    knowledgeDB.repos.merge(nodes),
    knowledgeDB.views,
    { root: TEST_WORKSPACE_ID, indexStack: List<number>() },
    (workspace, ctx) =>
      addRelationToNode(workspace, title.id, ctx.view.relationType)
  );
  await renderKnowledgeApp({
    ...knowledgeDB,
    ...addNoteToWorkspace,
  });
  await screen.findByText("My first title");
  expect(
    screen.queryByLabelText("show summaries of My first title")
  ).toBeNull();
});
