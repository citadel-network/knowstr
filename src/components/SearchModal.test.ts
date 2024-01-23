import { screen, fireEvent } from "@testing-library/react";
import { List } from "immutable";
import userEvent from "@testing-library/user-event";
import { newNode } from "../connections";
import { ALICE, matchSplitText, renderApp, setup } from "../utils.test";
import { getNode, newRepo } from "../knowledge";
import { createPlan, planUpsertNode } from "../planner";
import { execute } from "../executor";

test("Search works like spotlight", async () => {
  const [alice] = setup([ALICE]);
  const { publicKey } = alice().user;

  const note = newNode("My very first search note made", publicKey);
  const secondNote = newNode("My second search note ever made", publicKey);
  const thirdNote = newNode("My third search note made", publicKey);
  const topic = newNode("My very first topic", publicKey);
  await execute({
    ...alice(),
    plan: planUpsertNode(
      planUpsertNode(
        planUpsertNode(planUpsertNode(createPlan(alice()), note), secondNote),
        thirdNote
      ),
      topic
    ),
  });

  renderApp(alice());

  // Pressing enter adds first search result -which is a topic) to Column
  const searchButton = await screen.findByLabelText(
    "search and attach to My first Workspace"
  );
  fireEvent.click(searchButton);
  const searchInput = await screen.findByLabelText("search input");
  userEvent.type(searchInput, "My very first");
  const searchResults = await screen.findAllByText("My very first", {
    exact: false,
  });
  expect(searchResults).toHaveLength(2);
  const firstResult = screen.getByText(matchSplitText("My very first topic"));
  userEvent.type(firstResult, "{enter}");
  expect(screen.queryByLabelText("search input")).toBeNull();
  await screen.findAllByText("My very first topic");

  // Pressing down and enter adds second search result to Note
  const searchButtons = await screen.findAllByLabelText(
    "search and attach to My very first topic"
  );
  fireEvent.click(searchButtons[0]);
  const secondSearchInput = await screen.findByLabelText("search input");
  userEvent.type(secondSearchInput, "search note");
  const secondSearchResults = await screen.findAllByText("search note", {
    exact: false,
  });
  expect(secondSearchResults).toHaveLength(3);
  const secondResult = screen.getByText(
    matchSplitText("My second search note ever made")
  );
  userEvent.type(secondSearchInput, "{arrowdown}");
  userEvent.type(secondResult, "{enter}");
  expect(screen.queryByLabelText("search input")).toBeNull();
  await screen.findByText("My second search note ever made");

  const allSearchButtons = await screen.findByLabelText(
    "search and attach to My first Workspace"
  );
  fireEvent.click(allSearchButtons);
  const searchInputField = await screen.findByLabelText("search input");
  userEvent.type(searchInputField, "first search");
  await screen.findByText(matchSplitText("My very first search note made"));
  userEvent.type(searchInputField, "{escape}");
  expect(screen.queryByText("My first search note made")).toBeNull();
  userEvent.type(searchInputField, "{escape}");
  expect(screen.queryByPlaceholderText("Search")).toBeNull();
});

test("On Fullscreen, search also starts with press on slash key", async () => {
  const [alice] = setup([ALICE]);
  await execute({
    ...alice(),
    plan: planUpsertNode(
      createPlan(alice()),
      newNode("My source", alice().user.publicKey)
    ),
  });
  renderApp(alice());
  userEvent.type(await screen.findByText("My first Workspace"), "/");
  screen.getByPlaceholderText("Search");
  const searchInput = await screen.findByLabelText("search input");
  userEvent.type(searchInput, "My s{enter}");
  await screen.findByText("My source");
  expect(screen.queryByPlaceholderText("Search")).toBeNull();
});
