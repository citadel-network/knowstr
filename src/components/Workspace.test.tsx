import { fireEvent, screen, waitFor } from "@testing-library/react";
import { List, Map, OrderedMap } from "immutable";
import userEvent from "@testing-library/user-event";
import { addRelationToRelations, getRelations, newNode } from "../connections";
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
import { KnowledgeDiffWithCommits, applyDiff } from "../knowledgeEvents";

test("Create a new Workspace", async () => {
  const [alice] = setup([ALICE]);
  const { relayPool } = renderApp(alice());
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
    expect(relayPool.getEvents()).toHaveLength(1);
  });
  const utils = alice();
  const events = extractKnowledgeEvents(utils);

  const db = extractKnowledgeDB(alice());
  const wsId = db.activeWorkspace;

  const diffs = extractKnowledgeDiffs(utils, events);
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
  const knowledgeData = extractKnowledgeDB(alice());
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
        addRelationToRelations(workspace, note.id, view.relationType)
    ),
  };

  const [alice] = setup([ALICE]);
  await renderKnowledgeApp(knowledgeDBWithNotes, alice);
  userEvent.click(await screen.findByLabelText("increase width"));
  userEvent.click(await screen.findByLabelText("increase width"));
  await waitFor(async () =>
    userEvent.click((await screen.findAllByLabelText("Save Knowledge"))[0])
  );
  const knowledgeData = extractKnowledgeDB(alice());
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
  const updatedKnowledgeData = extractKnowledgeDB(alice());
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
