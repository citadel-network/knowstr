import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { List } from "immutable";
import Data from "../Data";
import {
  ALICE,
  setup,
  expectTextContent,
  renderApp,
  typeNewNode,
  matchSplitText,
  renderWithTestData,
  setupTestDB,
  findNodeByText,
} from "../utils.test";
import { newNode } from "../connections";
import { execute } from "../executor";
import { createPlan, planUpsertNode } from "../planner";
import { WorkspaceView } from "./Workspace";
import { RootViewContextProvider } from "../ViewContext";
import { TemporaryViewProvider } from "./TemporaryViewContext";
import { DND } from "../dnd";
import { Column } from "./Column";

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
  userEvent.click(await screen.findByText(matchSplitText("Java")));

  fireEvent.click(searchButton);
  const searchInput2 = await screen.findByLabelText("search input");
  userEvent.type(searchInput2, "Jav");
  userEvent.click(screen.getAllByText(matchSplitText("Java"))[1]);

  expectTextContent(
    await screen.findByLabelText("related to Programming Languages"),
    [
      "Java",
      "+Default",
      "New Relation Type",
      "Java",
      "+Default",
      "New Relation Type",
    ]
  );
});

test("Change Column width", async () => {
  const [alice] = setup([ALICE]);
  const view = renderWithTestData(
    <Data user={alice().user}>
      <WorkspaceView />
    </Data>
  );
  await typeNewNode(view, "Hello World");
  expect(screen.queryByLabelText("decrease width")).toBeNull();
  userEvent.click(await screen.findByLabelText("increase width"));
  // I can decrease once
  userEvent.click(await screen.findByLabelText("decrease width"));
  expect(screen.queryByLabelText("decrease width")).toBeNull();
});

test("Show Referenced By", async () => {
  const [alice] = setup([ALICE]);
  const aliceKnowledgeDB = await setupTestDB(alice(), [["Money", ["Bitcoin"]]]);
  const btc = findNodeByText(aliceKnowledgeDB, "Bitcoin") as KnowNode;
  const db = await setupTestDB(alice(), [
    ["Alice Workspace", [[btc], ["P2P Apps", [btc]]]],
  ]);
  const aliceWs = findNodeByText(db, "Alice Workspace") as KnowNode;
  renderWithTestData(
    <Data user={alice().user}>
      <RootViewContextProvider root={aliceWs.id} indices={List([0])}>
        <TemporaryViewProvider>
          <DND>
            <Column />
          </DND>
        </TemporaryViewProvider>
      </RootViewContextProvider>
    </Data>,
    {
      ...alice(),
      initialRoute: `/w/${aliceWs.id}`,
    }
  );
  await screen.findByText("Bitcoin");
  const references = await screen.findByLabelText("show references to Bitcoin");
  userEvent.click(references);
  expectTextContent(await screen.findByLabelText("related to Bitcoin"), [
    "Money1",
    "+Default",
    "New Relation Type",
    "Alice Workspace2",
    "+Default",
    "New Relation Type",
    "P2P Apps1",
    "+Default",
    "New Relation Type",
  ]);
  // 3 References: WS, P2P Apps and Money
  screen.getByText("Referenced By (3)");
});

test("Don't show Referenced By if parent relation is the only reference", async () => {
  const [alice] = setup([ALICE]);
  const db = await setupTestDB(alice(), [["Money", ["Bitcoin"]]]);
  const money = findNodeByText(db, "Money") as KnowNode;
  renderWithTestData(
    <Data user={alice().user}>
      <RootViewContextProvider root={money.id}>
        <TemporaryViewProvider>
          <DND>
            <Column />
          </DND>
        </TemporaryViewProvider>
      </RootViewContextProvider>
    </Data>,
    {
      ...alice(),
      initialRoute: `/d/${money.id}`,
    }
  );
  await screen.findByText("Money");
  expectTextContent(await screen.findByLabelText("related to Money"), [
    "Bitcoin",
    "+Default",
    "New Relation Type",
  ]);
});

test("If Node is the root we always show references when there are more than 0", async () => {
  const [alice] = setup([ALICE]);
  const db = await setupTestDB(alice(), [["Money", ["Bitcoin"]]]);
  const bitcoin = findNodeByText(db, "Bitcoin") as KnowNode;
  renderWithTestData(
    <Data user={alice().user}>
      <RootViewContextProvider root={bitcoin.id}>
        <TemporaryViewProvider>
          <DND>
            <Column />
          </DND>
        </TemporaryViewProvider>
      </RootViewContextProvider>
    </Data>,
    {
      ...alice(),
      initialRoute: `/d/${bitcoin.id}`,
    }
  );
  await screen.findByText("Bitcoin");
  const references = await screen.findByLabelText("show references to Bitcoin");
  userEvent.click(references);
  expectTextContent(await screen.findByLabelText("related to Bitcoin"), [
    "Money1",
    "+Default",
    "New Relation Type",
  ]);
  screen.getByText("Referenced By (1)");
});
