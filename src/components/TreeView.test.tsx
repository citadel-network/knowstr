import React from "react";
import { List } from "immutable";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ALICE,
  BOB,
  findNodeByText,
  follow,
  renderWithTestData,
  setup,
  setupTestDB,
} from "../utils.test";
import Data from "../Data";
import { LoadNode } from "../dataQuery";
import { RootViewContextProvider } from "../ViewContext";
import { TreeView } from "./TreeView";

test("Load Referenced By Nodes", async () => {
  const [alice] = setup([ALICE]);
  const aliceDB = await setupTestDB(alice(), [
    ["Alice Workspace", [["Money", ["Bitcoin"]]]],
  ]);
  const bitcoin = findNodeByText(aliceDB, "Bitcoin") as KnowNode;
  const aliceWs = findNodeByText(aliceDB, "Alice Workspace") as KnowNode;

  await setupTestDB(alice(), [
    ["Cryptocurrencies", [bitcoin]],
    ["P2P Apps", [bitcoin]],
  ]);
  renderWithTestData(
    <Data user={alice().user}>
      <LoadNode waitForEose>
        <RootViewContextProvider root={aliceWs.id} indices={List([0])}>
          <LoadNode>
            <TreeView />
          </LoadNode>
        </RootViewContextProvider>
      </LoadNode>
    </Data>,
    {
      ...alice(),
      initialRoute: `/w/${aliceWs.id}`,
    }
  );
  await screen.findByText("Bitcoin");
  screen.getByText("3");
  userEvent.click(screen.getByLabelText("show references to Bitcoin"));
  await screen.findByText("Cryptocurrencies");
  await screen.findByText("P2P Apps");
});

test("Load Social Nodes", async () => {
  const [alice, bob] = setup([ALICE, BOB]);
  await follow(alice, bob().user.publicKey);
  const aliceDB = await setupTestDB(alice(), [
    ["Alice Workspace", [["Money", ["Bitcoin"]]]],
  ]);
  const bitcoin = findNodeByText(aliceDB, "Bitcoin") as KnowNode;
  const aliceWs = findNodeByText(aliceDB, "Alice Workspace") as KnowNode;

  await setupTestDB(bob(), [
    [bitcoin, ["Censorship Resistance", "Electronic Cash"]],
  ]);
  renderWithTestData(
    <Data user={alice().user}>
      <LoadNode waitForEose>
        <RootViewContextProvider root={aliceWs.id} indices={List([0])}>
          <LoadNode>
            <TreeView />
          </LoadNode>
        </RootViewContextProvider>
      </LoadNode>
    </Data>,
    {
      ...alice(),
      initialRoute: `/w/${aliceWs.id}`,
    }
  );
  await screen.findByText("Bitcoin");
  userEvent.click(
    screen.getByLabelText("show items created by contacts of Bitcoin")
  );
  await screen.findByText("Censorship Resistance");
  await screen.findByText("Electronic Cash");
});
