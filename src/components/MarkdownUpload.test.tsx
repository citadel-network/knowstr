import React from "react";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { List } from "immutable";
import { RootViewContextProvider, newRelations } from "../ViewContext";
import { execute } from "../executor";
import { createPlan, planUpsertRelations } from "../planner";
import { ALICE, renderWithTestData, setup, UpdateState } from "../utils.test";
import { planCreateNodesFromMarkdown } from "./FileDropZone";
import { Column } from "./Column";
import { addRelationToRelations, joinID } from "../connections";

const TEST_FILE = `# Programming Languages

## Java

Java is a programming language

## Python

Python is a programming language
`;

async function uploadAndRenderMarkdown(alice: UpdateState): Promise<void> {
  const [plan, topNodeID] = planCreateNodesFromMarkdown(
    createPlan(alice()),
    TEST_FILE
  );
  const wsID = joinID(alice().user.publicKey, "my-first-workspace");
  const addNodeToWS = planUpsertRelations(
    plan,
    addRelationToRelations(
      newRelations(wsID, "", alice().user.publicKey),
      topNodeID
    )
  );
  await execute({
    ...alice(),
    plan: addNodeToWS,
  });

  renderWithTestData(
    <RootViewContextProvider root={wsID} indices={List([0])}>
      <Column />
    </RootViewContextProvider>,
    alice()
  );
  await screen.findByText("Programming Languages");
}

test("Markdown Upload", async () => {
  const [alice] = setup([ALICE]);
  await uploadAndRenderMarkdown(alice);
  screen.getByText("Java");
  screen.getByText("Java is a programming language");
  screen.getByText("Python");
  screen.getByText("Python is a programming language");
});

test("Delete Node uploaded from Markdown", async () => {
  const [alice] = setup([ALICE]);
  await uploadAndRenderMarkdown(alice);
  userEvent.click(screen.getByLabelText("edit Python"));
  userEvent.click(screen.getByLabelText("delete node"));

  expect(screen.queryByText("Python")).toBeNull();
  screen.getByText("Java");

  cleanup();

  const wsID = joinID(alice().user.publicKey, "my-first-workspace");
  // Test after rerender
  renderWithTestData(
    <RootViewContextProvider root={wsID} indices={List([0])}>
      <Column />
    </RootViewContextProvider>,
    alice()
  );
  await screen.findByText("Java");
  expect(screen.queryByText("Python")).toBeNull();
});

test("Edit Node uploaded from Markdown", async () => {
  const [alice] = setup([ALICE]);
  await uploadAndRenderMarkdown(alice);

  userEvent.click(screen.getByLabelText("edit Programming Languages"));
  userEvent.keyboard("{backspace}s OOP{enter}");
  userEvent.click(screen.getByText("Save"));
  await screen.findByText("Programming Languages OOP");
  expect(screen.queryByText("Programming Languages")).toBeNull();
});

/* eslint-disable no-console */
const originalError = console.error.bind(console.error);
// NostrQueryProvider has side effects which will lead to
// An update to NostrQueryProvider inside a test... errors
beforeAll(() => {
  // eslint-disable-next-line functional/immutable-data
  console.error = (msg, params) => {
    if (!msg.toString().includes("getBoundingClientRect")) {
      originalError(msg, params);
    }
  };
});

afterAll(() => {
  // eslint-disable-next-line functional/immutable-data
  console.error = originalError;
});
/* eslint-enable no-console */
