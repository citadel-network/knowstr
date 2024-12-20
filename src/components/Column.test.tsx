import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { List } from "immutable";
import Data from "../Data";
import {
  ALICE,
  setup,
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
import { PushNode, RootViewContextProvider } from "../ViewContext";
import { TemporaryViewProvider } from "./TemporaryViewContext";
import { DND } from "../dnd";
import { WorkspaceColumnView } from "./WorkspaceColumn";
import { RootViewOrWorkspaceIsLoading } from "./Dashboard";

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
  await userEvent.type(searchInput, "Jav");
  await userEvent.click(await screen.findByText(matchSplitText("Java")));

  fireEvent.click(searchButton);
  const searchInput2 = await screen.findByLabelText("search input");
  await userEvent.type(searchInput2, "Jav");
  await waitFor(() => {
    expect(screen.getAllByText(matchSplitText("Java"))).toHaveLength(2);
  });
  await userEvent.click(screen.getAllByText(matchSplitText("Java"))[1]);

  expect(
    (await screen.findByLabelText("related to Programming Languages"))
      .textContent
  ).toMatch(/Java(.*)Java/);
});

test("Change Column width", async () => {
  const [alice] = setup([ALICE]);
  const view = renderWithTestData(
    <Data user={alice().user}>
      <RootViewOrWorkspaceIsLoading>
        <WorkspaceView />
      </RootViewOrWorkspaceIsLoading>
    </Data>
  );
  await typeNewNode(view, "Hello World");
  expect(screen.queryByLabelText("decrease width")).toBeNull();
  await userEvent.click(
    await screen.findByLabelText("increase width of Hello World")
  );
  // I can decrease once
  await userEvent.click(
    await screen.findByLabelText("decrease width of Hello World")
  );
  expect(screen.queryByLabelText("decrease width of Hello World")).toBeNull();
});

test("Show Referenced By", async () => {
  const [alice] = setup([ALICE]);
  const aliceKnowledgeDB = await setupTestDB(alice(), [["Money", ["Bitcoin"]]]);
  const btc = findNodeByText(aliceKnowledgeDB, "Bitcoin") as KnowNode;
  const db = await setupTestDB(
    alice(),
    [["Alice Workspace", [[btc], ["P2P Apps", [btc]]]]],
    { activeWorkspace: "Alice Workspace" }
  );
  renderWithTestData(
    <Data user={alice().user}>
      <RootViewOrWorkspaceIsLoading>
        <PushNode push={List([0])}>
          <WorkspaceColumnView />
        </PushNode>
      </RootViewOrWorkspaceIsLoading>
    </Data>,
    {
      ...alice(),
      initialRoute: `/w/${db.activeWorkspace}`,
    }
  );
  await screen.findByText("Bitcoin");
  fireEvent.click(screen.getByLabelText("Add new Relations to Bitcoin"));
  fireEvent.click((await screen.findAllByText("Referenced By"))[0]);
  screen.getByLabelText("hide references to Bitcoin");
  expect(
    (await screen.findByLabelText("related to Bitcoin")).textContent
  ).toMatch(/Money1(.*)Alice Workspace2(.*)P2P Apps1/);
  // 3 References: WS, P2P Apps and Money, sorted according to relations.updated
  screen.getByText("Referenced By (3)");

  // Delete Referenced By
  fireEvent.click(screen.getByLabelText("edit virtual list"));
  fireEvent.click(await screen.findByText("Delete"));
  expect(screen.queryByText("Referenced By (3)")).toBeNull();
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
            <WorkspaceColumnView />
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
  await screen.findByText("Bitcoin");
  fireEvent.click(screen.getByLabelText("Add new Relations to Bitcoin"));
  fireEvent.click(await screen.findByText("Referenced By"));
  screen.getByLabelText("hide references to Bitcoin");
  expect(
    (await screen.findByLabelText("related to Bitcoin")).textContent
  ).toMatch(/Money1(.*)/);
  screen.getByText("Referenced By (1)");
});
