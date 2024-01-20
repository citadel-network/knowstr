import { screen, fireEvent, waitFor } from "@testing-library/react";
import { List, Map } from "immutable";
import userEvent from "@testing-library/user-event";
import {
  addRelationToRelations,
  bulkAddRelations,
  newNode,
} from "../connections";
import {
  ALICE,
  TEST_WORKSPACE_ID,
  createDefaultKnowledgeTestData,
  matchSplitText,
  renderKnowledgeApp,
} from "../utils.test";
import { getNode, newRepo } from "../knowledge";
import { updateNode } from "../ViewContext";

test("Search works like spotlight", async () => {
  const knowledgeDB = createDefaultKnowledgeTestData();
  const note = newRepo(newNode("My first search note made", "NOTE"));
  const secondNote = newRepo(
    newNode("My second search note ever made", "NOTE")
  );
  const thirdNote = newRepo(newNode("My third search note made", "NOTE"));
  const topic = newRepo(newNode("My first topic", "TOPIC"));
  const knowledgeWithNode = {
    ...knowledgeDB,
    repos: knowledgeDB.repos.merge(
      Map<Repo>({
        [note.id]: note,
        [secondNote.id]: secondNote,
        [thirdNote.id]: thirdNote,
        [topic.id]: topic,
      })
    ),
  };
  await renderKnowledgeApp(knowledgeWithNode);

  // Pressing enter adds first search result -which is a topic) to Column
  const searchButton = await screen.findByLabelText("search");
  fireEvent.click(searchButton);
  const searchInput = await screen.findByLabelText("search input");
  userEvent.type(searchInput, "My first");
  const searchResults = await screen.findAllByText("My first", {
    exact: false,
  });
  expect(searchResults).toHaveLength(2);
  const firstResult = screen.getByText(matchSplitText("My first topic"));
  userEvent.type(firstResult, "{enter}");
  expect(screen.queryByLabelText("search input")).toBeNull();
  await screen.findAllByText("My first topic");

  // Pressing down and enter adds second search result to Note
  const searchButtons = await screen.findAllByLabelText("search");
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

  // clicking adds search result to Note
  fireEvent.click(
    screen.getByLabelText(
      "show relevant relations of My second search note ever made"
    )
  );
  const newSearchButtons = await screen.findAllByLabelText("search");
  expect(newSearchButtons).toHaveLength(3);
  fireEvent.click(newSearchButtons[0]);
  const thirdSearchInput = await screen.findByLabelText("search input");
  userEvent.type(thirdSearchInput, "note made");
  const thirdSearchResults = await screen.findAllByText("note made", {
    exact: false,
  });
  expect(thirdSearchResults).toHaveLength(2);
  fireEvent.click(
    screen.getByText(matchSplitText("My third search note made"))
  );
  expect(screen.queryByLabelText("search input")).toBeNull();
  await screen.findByText("My third search note made");

  // pressing escape removes search input and results, second press ends search
  const allSearchButtons = await screen.findAllByLabelText("search");
  fireEvent.click(allSearchButtons[0]);
  const searchInputField = await screen.findByLabelText("search input");
  userEvent.type(searchInputField, "first search");
  await screen.findByText(matchSplitText("My first search note made"));
  userEvent.type(searchInputField, "{escape}");
  expect(screen.queryByText("My first search note made")).toBeNull();
  userEvent.type(searchInputField, "{escape}");
  expect(screen.queryByPlaceholderText("Search")).toBeNull();
});

test("Search shows summary, but its related note is added", async () => {
  const knowledgeDB = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);
  const source = newRepo(newNode("My source", "TITLE"), "source-id");
  const quote = newRepo(newNode("My first quote", "QUOTE"), "quote-id");
  const secondQuote = newRepo(
    newNode("My second quote", "QUOTE"),
    "second-quote-id"
  );
  const summary = newRepo(newNode("My summary", "NOTE"), "summary-id");

  const nodes = Map<Repo>({
    [source.id]: newRepo(
      bulkAddRelations(getNode(source), [quote.id, secondQuote.id], "CONTAINS"),
      source.id
    ),
    [quote.id]: newRepo(
      addRelationToRelations(getNode(quote), summary.id, "SUMMARY"),
      quote.id
    ),
    [secondQuote.id]: secondQuote,
    [summary.id]: summary,
  });

  const addToWorkspace = updateNode(
    knowledgeDB.repos.merge(nodes),
    knowledgeDB.views,
    { root: TEST_WORKSPACE_ID, indexStack: List<number>() },
    (workspace, ctx) =>
      addRelationToRelations(workspace, secondQuote.id, ctx.view.relationType)
  );

  await renderKnowledgeApp({
    ...knowledgeDB,
    ...addToWorkspace,
  });
  // add summary to second quote
  screen.getByText("My second quote");
  screen.getByLabelText("show relevant relations of My second quote");
  fireEvent.click(screen.getAllByLabelText("search")[0]);
  const searchInput = await screen.findByLabelText("search input");
  userEvent.type(searchInput, "My first");
  // search doesn't show summary separately, but only with related note
  await screen.findByText("My summary");
  fireEvent.click(screen.getByText(matchSplitText("My first quote")));
  fireEvent.click(screen.getByLabelText("close"));
  // first quote is added to second quote, not summary, therefore first quote has second quote as referenced by
  fireEvent.click(screen.getAllByLabelText("search")[0]);
  const secondSearchInput = await screen.findByLabelText("search input");
  userEvent.type(secondSearchInput, "My first quote");
  fireEvent.click(await screen.findByText("My first quote"));
  fireEvent.click(screen.getByText("Referenced By (3)"));
  await screen.findByText("My second quote");
  expect(screen.queryByText("My summary")).toBeNull();
});

test("Search adds existing Summary with non-default branch", async () => {
  const knowledgeDB = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);
  const source = newRepo(newNode("My source", "TITLE"), "source-id");
  const quote = newRepo(newNode("My first quote", "QUOTE"), "quote-id");
  const secondQuote = newRepo(
    newNode("My second quote", "QUOTE"),
    "second-quote-id"
  );
  const newBranchPath: BranchPath = [ALICE.publicKey, "not-main"];
  const summary = newRepo(
    newNode("My summary", "NOTE"),
    "summary-id",
    newBranchPath
  );

  const nodes = Map<Repo>({
    [source.id]: newRepo(
      bulkAddRelations(getNode(source), [quote.id, secondQuote.id], "CONTAINS"),
      source.id
    ),
    [quote.id]: newRepo(
      addRelationToRelations(getNode(quote), summary.id, "SUMMARY"),
      quote.id
    ),
    [secondQuote.id]: secondQuote,
    [summary.id]: summary,
  });

  const addToWorkspace = updateNode(
    knowledgeDB.repos.merge(nodes),
    knowledgeDB.views,
    { root: TEST_WORKSPACE_ID, indexStack: List<number>() },
    (workspace, ctx) =>
      addRelationToRelations(workspace, secondQuote.id, ctx.view.relationType)
  );

  await renderKnowledgeApp({
    ...knowledgeDB,
    ...addToWorkspace,
  });
  // summary is found in search and can be added
  screen.getByText("My second quote");
  screen.getByLabelText("show relevant relations of My second quote");
  fireEvent.click(screen.getAllByLabelText("search")[0]);
  const searchInput = await screen.findByLabelText("search input");
  userEvent.type(searchInput, "My ");
  // search doesn't show summary separately, but only with related note
  await screen.findByText("My summary");
  screen.getByText(matchSplitText("My first quote"));
});

test("Search also shows source", async () => {
  const knowledgeDB = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);
  const source = newRepo(newNode("My source", "TITLE"), "source-id");
  const quote = newRepo(newNode("My first quote", "QUOTE"), "quote-id");
  const secondQuote = newRepo(
    newNode("My second quote", "QUOTE"),
    "second-quote-id"
  );

  const nodes = Map<Repo>({
    [source.id]: newRepo(
      bulkAddRelations(getNode(source), [quote.id, secondQuote.id], "CONTAINS"),
      source.id
    ),
    [quote.id]: quote,
    [secondQuote.id]: secondQuote,
  });

  const addToWorkspace = updateNode(
    knowledgeDB.repos.merge(nodes),
    knowledgeDB.views,
    { root: TEST_WORKSPACE_ID, indexStack: List<number>() },
    (workspace, ctx) =>
      addRelationToRelations(workspace, secondQuote.id, ctx.view.relationType)
  );

  await renderKnowledgeApp({
    ...knowledgeDB,
    ...addToWorkspace,
  });
  fireEvent.click(screen.getAllByLabelText("search")[0]);
  const searchInput = await screen.findByLabelText("search input");
  userEvent.type(searchInput, "My first quote");
  fireEvent.click(await screen.findByText("My source"));
  fireEvent.click(screen.getByText("My first quote"));
});

test("Search starts with press on slash key", async () => {
  const knowledgeDB = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);

  await renderKnowledgeApp(knowledgeDB);

  await waitFor(() => {
    userEvent.type(screen.getByText("My Workspace"), "/");
    screen.getByPlaceholderText("Search");
  });
});

test("On Fullscreen, search also starts with press on slash key", async () => {
  const knowledgeDB = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);
  const source = newRepo(newNode("My source", "TITLE"), "source-id");

  const nodes = Map<Repo>({
    [source.id]: source,
  });

  const addToWorkspace = updateNode(
    knowledgeDB.repos.merge(nodes),
    knowledgeDB.views,
    { root: TEST_WORKSPACE_ID, indexStack: List<number>() },
    (workspace, ctx) =>
      addRelationToRelations(workspace, source.id, ctx.view.relationType)
  );

  await renderKnowledgeApp({
    ...knowledgeDB,
    ...addToWorkspace,
  });

  userEvent.click(screen.getByText("My source"));

  await waitFor(() => {
    userEvent.type(screen.getByText("My Workspace"), "/");
    screen.getByPlaceholderText("Search");
  });
});
