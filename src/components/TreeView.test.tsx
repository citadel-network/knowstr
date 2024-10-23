import React from "react";
import { List } from "immutable";
import { fireEvent, screen } from "@testing-library/react";
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
  fireEvent.click(screen.getByLabelText("Add new Relations to Bitcoin"));
  fireEvent.click((await screen.findAllByText("Referenced By"))[0]);
  screen.getByText("Referenced By (3)");
  await screen.findByText("Cryptocurrencies");
  await screen.findByText("P2P Apps");
});
