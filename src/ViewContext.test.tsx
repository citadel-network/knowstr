import React from "react";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { List } from "immutable";
import Data from "./Data";
import {
  newNode,
  addRelationToRelations,
  bulkAddRelations,
  joinID,
} from "./connections";
import { execute } from "./executor";
import {
  createPlan,
  planBulkUpsertNodes,
  planUpsertRelations,
} from "./planner";
import {
  renderWithTestData,
  ALICE,
  setup,
  setupTestDB,
  findNodeByText,
  startDragging,
  dragUp,
  drop,
  extractNodes,
  BOB,
  connectContacts,
} from "./utils.test";
import { ViewContextProvider, newRelations } from "./ViewContext";
import { WorkspaceView } from "./components/Workspace";
import { TreeView } from "./components/TreeView";

test("Move View Settings on Delete", async () => {
  const [alice] = setup([ALICE]);
  const { publicKey } = alice().user;

  const c = newNode("C", publicKey);
  const cpp = newNode("C++", publicKey);
  const java = newNode("Java", publicKey);
  const pl = newNode("Programming Languages", publicKey);

  const planWithNodes = planBulkUpsertNodes(createPlan(alice()), [
    c,
    cpp,
    java,
    pl,
  ]);

  const wsRelations = addRelationToRelations(
    newRelations(joinID(publicKey, "my-first-workspace"), "", publicKey),
    pl.id
  );
  const planWithRelations = planUpsertRelations(
    planUpsertRelations(
      planUpsertRelations(
        planWithNodes,
        bulkAddRelations(newRelations(pl.id, "", publicKey), [c.id, java.id])
      ),
      wsRelations
    ),
    addRelationToRelations(newRelations(c.id, "", publicKey), cpp.id)
  );

  await execute({
    ...alice(),
    plan: planWithRelations,
  });

  renderWithTestData(
    <Data user={alice().user}>
      <WorkspaceView />
    </Data>,
    alice()
  );
  fireEvent.click(await screen.findByLabelText("show Default items of C"));
  await screen.findByText("C++");
  // Remove JAVA Node
  userEvent.click(
    screen.getByLabelText("toggle multiselect Programming Languages")
  );
  userEvent.click(screen.getByLabelText("select Java"));
  userEvent.click(screen.getByLabelText("disconnect 1 selected nodes"));
  // Ensure C is still expanded
  await screen.findByText("C++");
  screen.getByLabelText("hide Default items of C");

  userEvent.click(screen.getByLabelText("hide Default items of C"));
  screen.getByLabelText("show Default items of C");
  expect(screen.queryByText("C++")).toBeNull();
});

test("Move Node Up", async () => {
  const [alice] = setup([ALICE]);
  const executedPlan = await setupTestDB(
    alice(),
    [
      [
        "My Workspace",
        [["Programming Languages", [["FPL"], ["OOP", ["C++", "Java"]]]]],
      ],
    ],
    {
      activeWorkspace: "My Workspace",
    }
  );
  const root = (findNodeByText(executedPlan, "My Workspace") as KnowNode).id;
  const utils = renderWithTestData(
    <Data user={alice().user}>
      <ViewContextProvider root={root} indices={List([0])}>
        <TreeView />
      </ViewContextProvider>
    </Data>,
    alice()
  );
  await screen.findByText("FPL");
  expect(extractNodes(utils.container)).toEqual(["FPL", "OOP"]);
  userEvent.click(screen.getByLabelText("show Default items of OOP"));
  expect(extractNodes(utils.container)).toEqual(["FPL", "OOP", "C++", "Java"]);

  const draggableID = `${root}:0:1`;
  const el = startDragging(utils.container, draggableID);
  dragUp(el);
  drop(el);
  expect(extractNodes(utils.container)).toEqual(["OOP", "C++", "Java", "FPL"]);
  cleanup();

  const { container } = renderWithTestData(
    <Data user={alice().user}>
      <ViewContextProvider root={root} indices={List([0])}>
        <TreeView />
      </ViewContextProvider>
    </Data>,
    alice()
  );
  await screen.findByText("FPL");
  expect(extractNodes(container)).toEqual(["OOP", "C++", "Java", "FPL"]);
});

test("Contact reorders list", async () => {
  const [alice, bob] = setup([ALICE, BOB]);
  connectContacts(alice, bob);
  const bobsKnowledgeDB = await setupTestDB(bob(), [
    [
      "Bobs Workspace",
      [["Programming Languages", [["OOP", ["C++", "Java"]], ["FPL"]]]],
    ],
  ]);
  const pl = findNodeByText(
    bobsKnowledgeDB,
    "Programming Languages"
  ) as KnowNode;

  const aliceDB = await setupTestDB(alice(), [["My Workspace", [pl]]]);
  const root = (findNodeByText(aliceDB, "My Workspace") as KnowNode).id;
  const utils = renderWithTestData(
    <Data user={alice().user}>
      <ViewContextProvider root={root} indices={List([0])}>
        <TreeView />
      </ViewContextProvider>
    </Data>,
    alice()
  );
  await screen.findByText("FPL");
  expect(extractNodes(utils.container)).toEqual(["OOP", "FPL"]);
  userEvent.click(screen.getByLabelText("show Default items of OOP"));
  await screen.findByText("C++");
  expect(extractNodes(utils.container)).toEqual(["OOP", "C++", "Java", "FPL"]);
  cleanup();

  // let bob remove OOP
  renderWithTestData(
    <Data user={bob().user}>
      <ViewContextProvider root={root} indices={List([0])}>
        <TreeView />
      </ViewContextProvider>
    </Data>,
    bob()
  );
  userEvent.click(await screen.findByLabelText("edit OOP"));
  userEvent.click(screen.getByLabelText("delete node"));
  cleanup();

  const { container } = renderWithTestData(
    <Data user={alice().user}>
      <ViewContextProvider root={root} indices={List([0])}>
        <TreeView />
      </ViewContextProvider>
    </Data>,
    alice()
  );
  // OOP is gone, so are it's children
  await screen.findByText("FPL");
  expect(extractNodes(container)).toEqual(["FPL"]);
});
