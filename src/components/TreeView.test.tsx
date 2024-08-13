import React from "react";
import { List } from "immutable";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ALICE,
  findNodeByText,
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
  await userEvent.click(screen.getByLabelText("show references to Bitcoin"));
  await screen.findByText("Cryptocurrencies");
  await screen.findByText("P2P Apps");
});
