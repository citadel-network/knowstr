import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Data from "../Data";
import {
  ALICE,
  setup,
  expectTextContent,
  renderApp,
  typeNewNode,
  matchSplitText,
  renderWithTestData,
} from "../utils.test";
import { newNode } from "../connections";
import { execute } from "../executor";
import { createPlan, planUpsertNode } from "../planner";
import { ViewContextProvider } from "../ViewContext";
import { WorkspaceView } from "./Workspace";

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
  userEvent.click(screen.getByText(matchSplitText("Java")));

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
      " Referenced By (1)",
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
