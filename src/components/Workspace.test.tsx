import { fireEvent, screen, waitFor } from "@testing-library/react";
import { List, Map, OrderedMap } from "immutable";
import userEvent from "@testing-library/user-event";
import { addRelationToNode, getRelations, newNode } from "../connections";
import {
  ALICE,
  renderApp,
  renderKnowledgeApp,
  createDefaultKnowledgeTestData,
  TEST_WORKSPACE_ID,
  extractKnowledgeDB,
  setup,
  extractKnowledgeDiffs,
  extractKnowledgeEvents,
} from "../utils.test";
import { DEFAULT_BRANCH_NAME, getNode, newDB, newRepo } from "../knowledge";
import { viewPathToString, updateNode, updateView } from "../ViewContext";
import {
  KnowledgeDiffWithCommits,
  applyDiff,
  isBootstrapEvent,
} from "../knowledgeEvents";

test("Create a new Workspace", async () => {
  const [alice] = setup([ALICE]);
  const { relayPool } = renderApp(await alice());
  const switchWsBtn = await screen.findByLabelText("switch workspace");
  userEvent.click(switchWsBtn);
  const newWsBtn = screen.getByText("New Workspace");
  fireEvent.click(newWsBtn);
  userEvent.type(
    screen.getByLabelText("title of new workspace"),
    "My first Workspace"
  );
  userEvent.click(screen.getByText("Create Workspace"));
  userEvent.click(screen.getByLabelText("Save Knowledge"));
  await waitFor(() => {
    expect(relayPool.getEvents()).toHaveLength(2);
  });
  const utils = await alice();
  const events = await extractKnowledgeEvents(utils);

  const db = await extractKnowledgeDB(await alice());
  const wsId = db.activeWorkspace;

  const diffs = await extractKnowledgeDiffs(utils, events);
  expect(diffs.size).toBe(1);

  const diff = diffs.first();
  expect(diff).toEqual(
    expect.objectContaining({
      activeWorkspace: wsId,
      views: undefined,
    })
  );

  const wsRepo = ((diff as KnowledgeDiffWithCommits).repos as Repos).get(wsId);
  expect(wsRepo).toEqual({
    branches: Map({
      main: {
        head: "6c34b6f4e6",
        origin: undefined,
      },
    }),
    commits: OrderedMap({
      "6c34b6f4e6": expect.objectContaining({
        hash: "6c34b6f4e6",
      }),
    }),
    objects: Map({
      "6c34b6f4e6": {
        nodeType: "WORKSPACE",
        relations: Map(),
        text: "My first Workspace",
      },
    }),
  });

  const knowData = applyDiff(newDB(), diff as KnowledgeDiffWithCommits);

  expect(knowData).toEqual(
    expect.objectContaining({
      activeWorkspace: wsId,
    })
  );
});

test("Active Workspace is set to Workspace id", async () => {
  const knowledgeDB = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);
  const [alice] = setup([ALICE]);
  await renderKnowledgeApp(knowledgeDB, alice);
  expect(await screen.findAllByText("My Workspace")).toHaveLength(1);
  const knowledgeData = await extractKnowledgeDB(await alice());
  expect(knowledgeData.repos.get(TEST_WORKSPACE_ID)).toBeDefined();
  expect(knowledgeData.activeWorkspace).toEqual(TEST_WORKSPACE_ID);
  const switchWsBtn = await screen.findByLabelText("switch workspace");
  await waitFor(() => userEvent.click(switchWsBtn));
  expect(screen.getAllByText("My Workspace")).toHaveLength(2);
});

test("Column width is saved and column width changes", async () => {
  const knowledgeDB = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);
  const note = newRepo(newNode("My first note", "NOTE"), "note1");
  const noteViewPath = {
    root: TEST_WORKSPACE_ID,
    indexStack: List<number>([0]),
  };
  const knowledgeDBWithNotes = {
    ...knowledgeDB,
    ...updateNode(
      knowledgeDB.repos.set(note.id, note),
      updateView(knowledgeDB.views, noteViewPath, {
        branch: [ALICE.publicKey, "main"],
        displaySubjects: false,
        relationType: "CONTAINS",
        width: 1,
      }),
      { root: TEST_WORKSPACE_ID, indexStack: List<number>() },
      (workspace, { view }) =>
        addRelationToNode(workspace, note.id, view.relationType)
    ),
  };

  const [alice] = setup([ALICE]);
  await renderKnowledgeApp(knowledgeDBWithNotes, alice);
  userEvent.click(await screen.findByLabelText("increase width"));
  userEvent.click(await screen.findByLabelText("increase width"));
  await waitFor(async () =>
    userEvent.click((await screen.findAllByLabelText("Save Knowledge"))[0])
  );
  const knowledgeData = await extractKnowledgeDB(await alice());
  expect(
    getRelations(
      getNode(knowledgeData.repos.get(TEST_WORKSPACE_ID) as Repo),
      "RELEVANCE"
    ).toArray()
  ).toEqual([
    {
      id: "note1",
    },
  ]);
  expect(knowledgeData.views.get(viewPathToString(noteViewPath))).toEqual({
    branch: [undefined, DEFAULT_BRANCH_NAME],
    width: 3,
    relationType: "CONTAINS",
    displaySubjects: false,
    expanded: undefined,
  });
  userEvent.click(await screen.findByLabelText("decrease width"));
  await waitFor(async () =>
    userEvent.click((await screen.findAllByLabelText("Save Knowledge"))[0])
  );
  const updatedKnowledgeData = await extractKnowledgeDB(await alice());
  expect(
    getRelations(
      getNode(updatedKnowledgeData.repos.get(TEST_WORKSPACE_ID) as Repo),
      "RELEVANCE"
    ).toArray()
  ).toEqual([
    {
      id: "note1",
    },
  ]);
  expect(
    updatedKnowledgeData.views.get(viewPathToString(noteViewPath))
  ).toEqual(
    expect.objectContaining({
      width: 2,
      branch: [undefined, DEFAULT_BRANCH_NAME],
    })
  );
  const workspaceColumn = (await screen.findAllByTestId("ws-col"))[0];
  expect(workspaceColumn).toBeDefined();
  expect(workspaceColumn?.style).toMatchObject({ "grid-column": "span 2" });
});

test("Send bootstrap diff event", async () => {
  const [alice] = setup([ALICE]);
  const aliceUtils = await alice();
  const { relayPool } = renderApp({
    ...aliceUtils,
    testBootstrapInterval: 3,
  });
  const switchWsBtn = await screen.findByLabelText("switch workspace");
  userEvent.click(switchWsBtn);
  const newWsBtn = screen.getByText("New Workspace");
  fireEvent.click(newWsBtn);
  userEvent.type(
    screen.getByLabelText("title of new workspace"),
    "My first Workspace"
  );
  userEvent.click(screen.getByText("Create Workspace"));
  userEvent.click(await screen.findByText("Add Note"));
  userEvent.click(screen.getByText("Add Note"));
  userEvent.click(screen.getByLabelText("Save Knowledge"));
  // two events are sent, one broadcast key event and one diff event
  await waitFor(() => {
    expect(relayPool.getEvents()).toHaveLength(2);
  });

  // send second diff event
  fireEvent.click(await screen.findByText("Referenced By (1)"));
  userEvent.click(screen.getByLabelText("increase width"));
  userEvent.click(screen.getByLabelText("Save Knowledge"));
  await waitFor(() => {
    expect(relayPool.getEvents()).toHaveLength(3);
  });

  // send third diff event
  userEvent.click(screen.getByLabelText("increase width"));
  userEvent.click(screen.getByLabelText("Save Knowledge"));
  await waitFor(() => {
    expect(relayPool.getEvents()).toHaveLength(4);
  });

  // send fourth diff event
  userEvent.click(screen.getByLabelText("increase width"));
  userEvent.click(screen.getByLabelText("Save Knowledge"));
  await waitFor(() => {
    expect(relayPool.getEvents()).toHaveLength(5);
  });

  // instead of the 4th diff event a bootstrap diff is sent instead
  const db = await extractKnowledgeDB(aliceUtils);
  const wsId = db.activeWorkspace;

  const events = await extractKnowledgeEvents(aliceUtils);
  const bootstrapDiff = await extractKnowledgeDiffs(
    aliceUtils,
    events.filter((e) => isBootstrapEvent(e))
  );
  expect(bootstrapDiff.size).toBe(1);
  const dbWithDiff = bootstrapDiff && applyDiff(newDB(), bootstrapDiff.first());
  expect(dbWithDiff?.views.get(`${wsId}:0`, { width: 0 }).width).toEqual(4);
  expect(
    dbWithDiff?.views.get(`${wsId}:0`, { displaySubjects: false })
      .displaySubjects
  ).toBeTruthy();
});
