import React from "react";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { List, Map } from "immutable";
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
  follow,
} from "./utils.test";
import {
  RootViewContextProvider,
  calculateIndexFromNodeIndex,
  calculateNodeIndex,
  newRelations,
  parseViewPath,
  updateViewPathsAfterDisconnect,
  NodeIndex,
  addNodeToPath,
  viewPathToString,
} from "./ViewContext";
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
      <RootViewContextProvider root={root} indices={List([0])}>
        <TreeView />
      </RootViewContextProvider>
    </Data>,
    alice()
  );
  await screen.findByText("FPL");
  expect(extractNodes(utils.container)).toEqual(["FPL", "OOP"]);
  userEvent.click(screen.getByLabelText("show Default items of OOP"));
  expect(extractNodes(utils.container)).toEqual(["FPL", "OOP", "C++", "Java"]);

  const draggableID = viewPathToString(
    addNodeToPath(
      executedPlan.knowledgeDBs,
      executedPlan.user.publicKey,
      addNodeToPath(
        executedPlan.knowledgeDBs,
        executedPlan.user.publicKey,
        [{ nodeID: root, nodeIndex: 0 as NodeIndex }],
        0
      ),
      1
    )
  );
  const el = startDragging(utils.container, draggableID);
  dragUp(el);
  drop(el);
  expect(extractNodes(utils.container)).toEqual(["OOP", "C++", "Java", "FPL"]);
  cleanup();

  const { container } = renderWithTestData(
    <Data user={alice().user}>
      <RootViewContextProvider root={root} indices={List([0])}>
        <TreeView />
      </RootViewContextProvider>
    </Data>,
    alice()
  );
  await screen.findByText("FPL");
  expect(extractNodes(container)).toEqual(["OOP", "C++", "Java", "FPL"]);
});

test("Contact reorders list", async () => {
  const [alice, bob] = setup([ALICE, BOB]);
  await follow(alice, bob().user.publicKey);
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
      <RootViewContextProvider root={root} indices={List([0])}>
        <TreeView />
      </RootViewContextProvider>
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
  const bobsWorkspace = findNodeByText(
    bobsKnowledgeDB,
    "Bobs Workspace"
  ) as KnowNode;
  renderWithTestData(
    <Data user={bob().user}>
      <RootViewContextProvider root={bobsWorkspace.id} indices={List([0])}>
        <TreeView />
      </RootViewContextProvider>
    </Data>,
    bob()
  );
  userEvent.click(await screen.findByLabelText("edit OOP"));
  userEvent.click(screen.getByLabelText("delete node"));
  cleanup();

  const { container } = renderWithTestData(
    <Data user={alice().user}>
      <RootViewContextProvider root={root} indices={List([0])}>
        <TreeView />
      </RootViewContextProvider>
    </Data>,
    alice()
  );
  // OOP is gone, so are it's children
  await screen.findByText("FPL");
  expect(extractNodes(container)).toEqual(["FPL"]);
});

test("Alter View paths after disconnect", () => {
  // Assume I'm deleting r:n:1 (first occurance of n in r)
  const views = Map<string, { e: string }>({
    "root:0:r:n:1": { e: "delete" },
    "root:0:r:n:3": { e: "root:0:r:n:2" },
    "root:0:r:n:12": { e: "root:0:r:n:11" },
    "root2:0:r:n:2:r:n:3": { e: "root2:0:r:n:1:r:n:2" },
    "root2:0:r:n:2:r:n:1": { e: "delete" },
    "root2:0:r:n:1:r:n:2": { e: "delete" },
    "root:0:r:n:0": { e: "root:0:r:n:0" },
    "root:0:r:n:2:r2:a:0:r:n:45": { e: "root:0:r:n:1:r2:a:0:r:n:44" },
  });
  const updatedViews = updateViewPathsAfterDisconnect(
    views as unknown as Views,
    "n" as LongID,
    "r" as LongID,
    1 as NodeIndex
  );

  const expectedResult = views
    .filter((v) => v.e !== "delete")
    .mapEntries((e) => [e[1].e, e[1]]);
  expect(updatedViews.keySeq().toJS()).toEqual(expectedResult.keySeq().toJS());
});

test("Calculate index from node index", () => {
  const relations: Relations = {
    items: List(["pl", "oop", "pl", "pl", "java"]),
  } as Relations;
  expect(calculateNodeIndex(relations, 0)).toBe(0);
  expect(calculateNodeIndex(relations, 1)).toBe(0);
  expect(calculateNodeIndex(relations, 2)).toBe(1);
  expect(calculateNodeIndex(relations, 3)).toBe(2);
  expect(calculateNodeIndex(relations, 4)).toBe(0);

  expect(
    calculateIndexFromNodeIndex(relations, "pl" as LongID, 0 as NodeIndex)
  ).toBe(0);
  expect(
    calculateIndexFromNodeIndex(relations, "oop" as LongID, 0 as NodeIndex)
  ).toBe(1);
  expect(
    calculateIndexFromNodeIndex(relations, "pl" as LongID, 1 as NodeIndex)
  ).toBe(2);
  expect(
    calculateIndexFromNodeIndex(relations, "pl" as LongID, 2 as NodeIndex)
  ).toBe(3);
  expect(
    calculateIndexFromNodeIndex(relations, "java" as LongID, 0 as NodeIndex)
  ).toBe(4);
});

test("Parse View path", () => {
  expect(parseViewPath("root:1")).toEqual([{ nodeID: "root", nodeIndex: 1 }]);
  expect(parseViewPath("root:0:rl:pl:0")).toEqual([
    { nodeID: "root", nodeIndex: 0, relationsID: "rl" },
    { nodeID: "pl", nodeIndex: 0 },
  ]);
  expect(parseViewPath("root:0:rl:pl:0:rl:oop:1")).toEqual([
    { nodeID: "root", nodeIndex: 0, relationsID: "rl" },
    { nodeID: "pl", nodeIndex: 0, relationsID: "rl" },
    { nodeID: "oop", nodeIndex: 1 },
  ]);
});
