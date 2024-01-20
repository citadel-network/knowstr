import { screen, fireEvent, waitFor } from "@testing-library/react";
import { List, Map } from "immutable";
import {
  addRelationToRelations,
  bulkAddRelations,
  newNode,
} from "../connections";
import {
  TEST_WORKSPACE_ID,
  createDefaultKnowledgeTestData,
  matchSplitText,
  renderKnowledgeApp,
} from "../utils.test";
import { getNode, newRepo } from "../knowledge";
import { updateNode } from "../ViewContext";

test("Bionic Reading", async () => {
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
      addRelationToRelations(workspace, source.id, ctx.view.relationType)
  );

  await renderKnowledgeApp({
    ...knowledgeDB,
    ...addToWorkspace,
  });

  await screen.findByText("My first quote");
  fireEvent.click(screen.getByLabelText("open menu"));
  fireEvent.click(await screen.findByLabelText("switch bionic reading on"));
  await waitFor(() => {
    expect(screen.queryByText("My first quote")).toBeNull();
  });
  expect(screen.getByText(matchSplitText("My first quote")).innerHTML).toBe(
    "<b>M</b>y <b>fi</b>rst <b>qu</b>ote"
  );
});
