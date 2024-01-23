import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { Map, List } from "immutable";
import userEvent from "@testing-library/user-event";
import {
  addRelationToRelations,
  bulkAddRelations,
  newNode,
} from "../connections";
import { DND } from "../dnd";
import { getNode, newRepo } from "../knowledge";
import { RelationContext } from "../KnowledgeDataContext";
import {
  ALICE,
  TEST_WORKSPACE_ID,
  createDefaultKnowledgeTestData,
  renderKnowledgeApp,
  renderWithTestData,
  setup,
} from "../utils.test";
import { ViewContextProvider, newRelations, updateNode } from "../ViewContext";
import { Column } from "./Column";
import { TemporaryViewProvider } from "./TemporaryViewContext";
import {
  createPlan,
  planBulkUpsertNodes,
  planUpsertNode,
  planUpsertRelations,
} from "../planner";
import { execute } from "../executor";
import { Node } from "./Node";
import { TreeView } from "./TreeView";

test("Render non existing Node", async () => {
  const [alice] = setup([ALICE]);
  const { publicKey } = alice().user;
  const pl = newNode("Programming Languages", publicKey);
  const relations = addRelationToRelations(
    newRelations(pl.id, "", publicKey),
    "not-existing-id" as LongID
  );
  const plan = planUpsertRelations(
    planUpsertNode(createPlan(alice()), pl),
    relations
  );
  await execute({
    ...alice(),
    plan,
  });
  renderWithTestData(
    <ViewContextProvider root={pl.id}>
      <TemporaryViewProvider>
        <DND>
          <Column />
        </DND>
      </TemporaryViewProvider>
    </ViewContextProvider>,
    alice()
  );
  await screen.findByText("Programming Languages");
  screen.getByText("Error: Node not found");
});

test("Edit node via Column Menu", async () => {
  const [alice] = setup([ALICE]);
  const { publicKey } = alice().user;
  const note = newNode("My Note", publicKey);
  await execute({
    ...alice(),
    plan: planUpsertNode(createPlan(alice()), note),
  });
  renderWithTestData(
    <ViewContextProvider root={note.id}>
      <TemporaryViewProvider>
        <DND>
          <Column />
        </DND>
      </TemporaryViewProvider>
    </ViewContextProvider>,
    alice()
  );
  await screen.findByText("My Note");
  fireEvent.click(screen.getByLabelText("edit My Note"));
  userEvent.keyboard(
    "{backspace}{backspace}{backspace}{backspace}edited Note{enter}"
  );
  fireEvent.click(screen.getByLabelText("save"));
  expect(screen.queryByText("Save")).toBeNull();
  await screen.findByText("My edited Note");
});

test("Edit node inline", async () => {
  const [alice] = setup([ALICE]);
  const { publicKey } = alice().user;
  const note = newNode("My Note", publicKey);
  // Connect the note with itself so it's not the root note
  // Menu doesn't show on root notes
  const plan = planUpsertRelations(
    createPlan(alice()),
    addRelationToRelations(newRelations(note.id, "", publicKey), note.id)
  );
  await execute({
    ...alice(),
    plan: planUpsertNode(plan, note),
  });
  renderWithTestData(
    <ViewContextProvider root={note.id} indices={List([0, 0])}>
      <TemporaryViewProvider>
        <DND>
          <Node />
        </DND>
      </TemporaryViewProvider>
    </ViewContextProvider>,
    alice()
  );
  await screen.findByText("My Note");
  fireEvent.click(screen.getByLabelText("edit My Note"));
  userEvent.keyboard(
    "{backspace}{backspace}{backspace}{backspace}edited Note{enter}"
  );
  fireEvent.click(screen.getByLabelText("save"));
  expect(screen.queryByText("Save")).toBeNull();
  await screen.findByText("My edited Note");
});

test("Edited node is shown in Tree View", async () => {
  const [alice] = setup([ALICE]);
  const { publicKey } = alice().user;
  const pl = newNode("Programming Languages", publicKey);
  const oop = newNode("Object Oriented Programming languages", publicKey);
  const java = newNode("Java", publicKey);

  const plan = planUpsertRelations(
    planUpsertRelations(
      createPlan(alice()),
      addRelationToRelations(newRelations(pl.id, "", publicKey), oop.id)
    ),
    addRelationToRelations(newRelations(oop.id, "", publicKey), java.id)
  );
  await execute({
    ...alice(),
    plan: planBulkUpsertNodes(plan, [pl, oop, java]),
  });
  renderWithTestData(
    <ViewContextProvider root={pl.id} indices={List([0])}>
      <TemporaryViewProvider>
        <DND>
          <TreeView />
        </DND>
      </TemporaryViewProvider>
    </ViewContextProvider>,
    alice()
  );
  fireEvent.click(await screen.findByLabelText("edit Java"));
  userEvent.keyboard("{backspace}{backspace}{backspace}{backspace}C++{enter}");
  fireEvent.click(screen.getByLabelText("save"));
  expect(screen.queryByText("Save")).toBeNull();
  expect(screen.queryByText("Java")).toBeNull();
  await screen.findByText("C++");
});

test("Delete node", async () => {
  const [alice] = setup([ALICE]);
  const { publicKey } = alice().user;
  const note = newNode("My Note", publicKey);
  await execute({
    ...alice(),
    plan: planUpsertNode(createPlan(alice()), note),
  });
  renderWithTestData(
    <ViewContextProvider root={note.id}>
      <TemporaryViewProvider>
        <DND>
          <Column />
        </DND>
      </TemporaryViewProvider>
    </ViewContextProvider>,
    alice()
  );
  await screen.findByText("My Note");
  userEvent.click(screen.getByLabelText("edit My Note"));
  userEvent.click(screen.getByLabelText("delete node"));
  expect(screen.queryByText("My Note")).toBeNull();
});
