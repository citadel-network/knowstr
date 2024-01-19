import React from "react";
import { Map, List, OrderedSet } from "immutable";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newNode, addRelationToNode, bulkAddRelations } from "./connections";
import { execute } from "./executor";
import { DEFAULT_BRANCH_NAME, newDB, newRepo } from "./knowledge";
import { createPlan, planSetKnowledgeData } from "./planner";
import { renderWithTestData, ALICE, setup, commitAll } from "./utils.test";
import {
  findViewsForRepo,
  getNodeFromView,
  parseViewPath,
  updateViewPathsAfterAddRelation,
  ViewContextProvider,
} from "./ViewContext";
import { Column } from "./components/Column";
import { TemporaryViewProvider } from "./components/TemporaryViewContext";
import { dnd, DND } from "./dnd";
import { compareKnowledgeDB } from "./knowledgeEvents";

test("Move View Settings on Delete", async () => {
  const c = addRelationToNode(newNode("C", "TOPIC"), "cpp", "RELEVANCE");
  const cpp = newNode("C++", "TOPIC");
  const java = newNode("Java", "TOPIC");

  const plNode = bulkAddRelations(
    newNode("Programming Languages", "TOPIC"),
    ["j", "c"],
    "RELEVANCE"
  );
  const ws = addRelationToNode(
    newNode("WS:#00FF00", "WORKSPACE"),
    "pl",
    "RELEVANCE"
  );

  const repos = Map<Repo>({
    c: newRepo(c, "c"),
    cpp: newRepo(cpp, "cpp"),
    j: newRepo(java, "j"),
    pl: newRepo(plNode, "pl"),
    ws: newRepo(ws, "ws"),
  });

  const [alice] = setup([ALICE]);
  const knowledgeData = {
    repos,
    activeWorkspace: "ws",
    views: Map<string, View>(),
  };
  await execute({
    ...alice(),
    plan: planSetKnowledgeData(
      createPlan(alice()),
      compareKnowledgeDB(newDB(), commitAll(knowledgeData))
    ),
  });

  renderWithTestData(
    <ViewContextProvider root="ws" indices={List<number>([0])}>
      <TemporaryViewProvider>
        <DND>
          <Column />
        </DND>
      </TemporaryViewProvider>
    </ViewContextProvider>,
    alice()
  );
  fireEvent.click(await screen.findByLabelText("show relevant relations of C"));
  await screen.findByText("C++");
  // Collapse C
  userEvent.click(screen.getByLabelText("hide relevant relations of C"));
  screen.getByLabelText("show relevant relations of C");
  expect(screen.queryByText("C++")).toBeNull();
  // Remove JAVA Node
  userEvent.click(
    screen.getByLabelText("toggle multiselect Programming Languages")
  );
  userEvent.click(screen.getByLabelText("select Java"));
  userEvent.click(screen.getByLabelText("disconnect 1 selected nodes"));
  // Ensure that C is still collapsed
  screen.getByLabelText("show relevant relations of C");
  screen.getByText("C");
  expect(screen.queryByText("C++")).toBeNull();
});

// delete
// move
// add before

test("Move Views after insert", () => {
  // ws->
  //  pl
  //    java
  //    c
  //      cpp
  //    fortran
  //      c
  //        cpp
  //  fortran
  //    c
  //      cpp

  const c = addRelationToNode(newNode("C", "TOPIC"), "cpp", "RELEVANCE");
  const cpp = newNode("C++", "TOPIC");
  const java = newNode("Java", "TOPIC");
  const fortran = addRelationToNode(
    newNode("Fortran", "TOPIC"),
    "c",
    "RELEVANCE"
  );

  const plNode = bulkAddRelations(
    newNode("Programming Languages", "TOPIC"),
    ["j", "c", "f"],
    "RELEVANCE"
  );
  const ws = bulkAddRelations(
    newNode("WS:#00FF00", "WORKSPACE"),
    ["pl", "f"],
    "RELEVANCE"
  );

  const repos = Map<Repo>({
    c: newRepo(c, "c"),
    cpp: newRepo(cpp, "cpp"),
    j: newRepo(java, "j"),
    f: newRepo(fortran, "f"),
    pl: newRepo(plNode, "pl"),
    ws: newRepo(ws, "ws"),
  });

  const cppView: View = {
    displaySubjects: false,
    relationType: "RELEVANCE",
    width: 2,
    branch: [undefined, "main"],
  };

  const defaultView: View = {
    displaySubjects: false,
    relationType: "RELEVANCE",
    width: 1,
    branch: [undefined, "main"],
  };

  const views = Map<View>({
    "ws:0": defaultView, // Programming languages <pl>
    "ws:0:0": defaultView, // Java <j>
    "ws:0:1": defaultView, // C <c> under Programming languages
    "ws:0:1:0": cppView, // C++ under the C node that's under Programming languages
    "ws:0:2": defaultView, // Fortran <f> under Programming languages
    "ws:0:2:0": defaultView, // C <c> under the Fortran node that's under Programming languages
    "ws:0:2:0:0": cppView, // C++ under the C node that's under the Fortran node in Programming languages
    "ws:1": defaultView, // Fortran <f> under workspace
    "ws:1:0": defaultView, // C <c> under the Fortran node that's directly under the workspace
    "ws:1:0:0": cppView, // C++ under the C node that's under the Fortran node in the workspace
  });

  expect(
    findViewsForRepo(repos, views, "c", "RELEVANCE", [
      undefined,
      DEFAULT_BRANCH_NAME,
    ])
      .keySeq()
      .toArray()
  ).toEqual(["ws:0:2:0", "ws:1:0", "ws:0:1"]);

  const knowledgeData: KnowledgeData = {
    repos,
    activeWorkspace: "ws",
    views,
  };

  const updatedViews = updateViewPathsAfterAddRelation(
    knowledgeData.repos,
    knowledgeData.views,
    parseViewPath("c"),
    0
  );

  const expectedUpdatedViews = Map<View>({
    "ws:0": defaultView, // Programming languages <pl>
    "ws:0:0": defaultView, // Java <j>
    "ws:0:1": defaultView, // C <c> under Programming languages
    "ws:0:1:1": cppView, // C++ under the C node that's under Programming languages (moved)
    "ws:0:2": defaultView, // Fortran <f> under Programming languages
    "ws:0:2:0": defaultView, // C <c> under the Fortran node that's under Programming languages
    "ws:0:2:0:1": cppView, // C++ under the C node that's under the Fortran node in Programming languages (moved)
    "ws:1": defaultView, // Fortran <f> under workspace
    "ws:1:0": defaultView, // C <c> under the Fortran node that's directly under the workspace
    "ws:1:0:1": cppView, // C++ under the C node that's under the Fortran node in the workspace (moved)
  });

  expect(updatedViews.sortBy((v, k) => k)).toEqual(
    expectedUpdatedViews.sortBy((v, k) => k)
  );

  const updatedViews2 = updateViewPathsAfterAddRelation(
    repos,
    Map<View>({ "ws:0:1:0": cppView }), // C++ under the C node that's under Programming languages
    parseViewPath("ws:0:1"),
    0
  );
  expect(updatedViews2).toEqual(
    Map<View>({ "ws:0:1:1": cppView }) // C++ under the C node that's under Programming languages
  );
});

test("get repo from view for non exisitng path", () => {
  const repo = newRepo(newNode("C", "TOPIC"), "c");
  expect(
    getNodeFromView(Map<Repo>({ c: repo }), Map<string, View>(), {
      root: "c",
      indexStack: List<number>([1, 0, 0, 0, 0]),
    })
  ).toEqual([undefined, undefined]);
});

test("Update all relevant repos", () => {
  const ws = bulkAddRelations(
    newNode("WS:#00FF00", "WORKSPACE"),
    ["pl", "pl", "pl"],
    "RELEVANCE"
  );

  const plNode = bulkAddRelations(
    newNode("Programming Languages", "TOPIC"),
    ["j", "c", "f"],
    "RELEVANCE"
  );
  const c = newRepo(newNode("C", "TOPIC"), "c");
  const java = newRepo(newNode("Java", "TOPIC"), "j");
  const fortran = newRepo(newNode("Fortran", "TOPIC"), "f");
  const repos = Map<Repo>({
    c,
    j: java,
    f: fortran,
    pl: newRepo(plNode, "pl"),
    ws: newRepo(ws, "ws"),
  });

  const defaultView: View = {
    displaySubjects: false,
    relationType: "RELEVANCE",
    width: 1,
    branch: [undefined, "main"],
  };

  const views = Map<View>({
    "ws:2": {
      ...defaultView,
      relationType: "CONTAINS",
    },
    "ws:1:2": {
      // Fortran in the second column is collapsed
      ...defaultView,
      expanded: false,
    },
    "ws:0:0:5:5": {
      // this view setting is for a subview of c in the first column
      ...defaultView,
      expanded: true,
    },
  });

  // drag and drop fortran to the first place
  const { views: updatedViews } = dnd(
    repos,
    views,
    OrderedSet<string>(),
    "ws:1:2", // fortran first col,
    "tree:ws:1", // first col,
    0 // first position
  );
  expect(updatedViews).toEqual(
    Map<View>({
      "ws:2": {
        ...defaultView,
        relationType: "CONTAINS",
      },
      "ws:1:0": {
        // fortran got moved up
        // Fortran in the second column is collapsed
        ...defaultView,
        expanded: false,
      },
      "ws:0:1:5:5": {
        // subview of c got moved
        // this view setting is for a subview of c in the first column
        ...defaultView,
        expanded: true,
      },
    })
  );
});
