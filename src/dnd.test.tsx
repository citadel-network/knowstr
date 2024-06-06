import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import {
  ALICE,
  extractNodes,
  findNodeByText,
  renderWithTestData,
  setup,
  setupTestDB,
} from "./utils.test";
import { WorkspaceView } from "./components/Workspace";
import { LoadNode } from "./dataQuery";

test("Dragging Source not available at Destination", async () => {
  const [alice] = setup([ALICE]);
  // Cryptocurrencies => Bitcoin
  // Money
  const executedPlan = await setupTestDB(alice(), [
    ["Cryptocurrencies", ["Bitcoin"]],
    ["Money"],
  ]);
  const btc = findNodeByText(executedPlan, "Bitcoin");
  const money = findNodeByText(executedPlan, "Money");
  const planWithWs = await setupTestDB(alice(), [
    ["My Workspace", [btc as KnowNode, money as KnowNode]],
  ]);
  const root = (findNodeByText(planWithWs, "My Workspace") as KnowNode).id;
  renderWithTestData(
    <LoadNode waitForEose>
      <WorkspaceView />
    </LoadNode>,
    {
      ...alice(),
      initialRoute: `/w/${root}`,
    }
  );

  await screen.findByText("Bitcoin");
  fireEvent.click(screen.getByLabelText("show references to Bitcoin"));
  const crypto = await screen.findByText("Cryptocurrencies");
  const addToMoney = await screen.findByLabelText("add to Money");

  fireEvent.dragStart(crypto);
  fireEvent.drop(addToMoney);

  expect(extractNodes(screen.getAllByTestId("ws-col")[1])).toEqual([
    "Cryptocurrencies",
  ]);

  fireEvent.click(screen.getByText("Money"));
});
