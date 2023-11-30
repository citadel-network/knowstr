import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { Map, List } from "immutable";
import userEvent from "@testing-library/user-event";
import { addRelationToNode, bulkAddRelations, newNode } from "../connections";
import { DND } from "../dnd";
import { getNode, newRepo } from "../knowledge";
import { RelationContext } from "../KnowledgeDataContext";
import {
  TEST_WORKSPACE_ID,
  createDefaultKnowledgeTestData,
  renderKnowledgeApp,
  renderWithTestData,
} from "../utils.test";
import { ViewContextProvider, updateNode } from "../ViewContext";
import { Column } from "./Column";
import { TemporaryViewProvider } from "./TemporaryViewContext";

test("Render non existing Repo", async () => {
  const pl = newRepo(
    addRelationToNode(
      newNode("Programming Languages", "TOPIC"),
      "not-existing-id",
      "RELEVANCE"
    )
  );
  const repos = Map<Repo>({
    [pl.id]: pl,
    ws: newRepo(
      addRelationToNode(
        newNode("Workspace:#FF", "WORKSPACE"),
        pl.id,
        "RELEVANCE"
      )
    ),
  });
  renderWithTestData(
    <RelationContext.Provider
      value={{
        data: {
          repos,
          views: Map<string, View>(),
          activeWorkspace: "ws",
        },
        publishKnowledgeData: jest.fn(),
        hasUnpublishedData: false,
        setKnowledgeData: jest.fn(),
      }}
    >
      <TemporaryViewProvider>
        <DND>
          <ViewContextProvider root="ws" indices={List([0])}>
            <Column />
          </ViewContextProvider>
        </DND>
      </TemporaryViewProvider>
    </RelationContext.Provider>
  );
  await screen.findByText("Programming Languages");
  screen.getByText("Error: Node not found");
});

test("Edit node via Column Menu", async () => {
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
      addRelationToNode(workspace, source.id, ctx.view.relationType)
  );

  await renderKnowledgeApp({
    ...knowledgeDB,
    ...addToWorkspace,
  });
  await screen.findByText("My source");
  fireEvent.click(screen.getByLabelText("edit My source"));
  userEvent.keyboard(
    "{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}edited source{enter}"
  );
  fireEvent.click(screen.getByLabelText("save"));
  expect(screen.queryByText("Save")).toBeNull();
  await screen.findByText("My edited source");
});

test("Edit node inline", async () => {
  const knowledgeDB = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);
  const source = newRepo(newNode("My source", "TITLE"), "source-id");
  const firstQuote = newRepo(
    newNode("My first quote", "QUOTE"),
    "first-quote-id"
  );

  const nodes = Map<Repo>({
    [source.id]: newRepo(
      addRelationToNode(getNode(source), firstQuote.id, "CONTAINS"),
      source.id
    ),
    [firstQuote.id]: firstQuote,
  });

  const addToWorkspace = updateNode(
    knowledgeDB.repos.merge(nodes),
    knowledgeDB.views,
    { root: TEST_WORKSPACE_ID, indexStack: List<number>() },
    (workspace, ctx) =>
      addRelationToNode(workspace, source.id, ctx.view.relationType)
  );

  await renderKnowledgeApp({
    ...knowledgeDB,
    ...addToWorkspace,
  });
  await screen.findByText("My source");
  fireEvent.click(screen.getByLabelText("show contained nodes of My source"));
  await screen.findByText("My first quote");
  fireEvent.click(screen.getByLabelText("edit My first quote"));
  userEvent.keyboard(
    "{backspace}{backspace}{backspace}{backspace}{backspace}edited quote{enter}"
  );
  fireEvent.click(screen.getByLabelText("save"));
  expect(screen.queryByText("Save")).toBeNull();
  await screen.findByText("My first edited quote");
});

test("Edited node is shown in Tree View", async () => {
  const knowledgeDB = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);
  const source = newRepo(newNode("My source", "TITLE"), "source-id");
  const firstQuote = newRepo(
    newNode("My first quote", "QUOTE"),
    "first-quote-id"
  );
  const secondQuoteId = "second-quote-id";

  const nodes = Map<Repo>({
    [source.id]: newRepo(
      bulkAddRelations(
        getNode(source),
        [firstQuote.id, secondQuoteId],
        "CONTAINS"
      ),
      source.id
    ),
    [firstQuote.id]: firstQuote,
    [secondQuoteId]: newRepo(
      addRelationToNode(
        newNode("My second quote", "QUOTE"),
        firstQuote.id,
        "RELEVANCE"
      ),
      secondQuoteId
    ),
  });

  const addToWorkspace = updateNode(
    knowledgeDB.repos.merge(nodes),
    knowledgeDB.views,
    { root: TEST_WORKSPACE_ID, indexStack: List<number>() },
    (workspace, ctx) =>
      addRelationToNode(
        addRelationToNode(workspace, source.id, ctx.view.relationType),
        firstQuote.id,
        ctx.view.relationType
      )
  );

  await renderKnowledgeApp({
    ...knowledgeDB,
    ...addToWorkspace,
  });
  await screen.findByText("My source", { exact: false });
  fireEvent.click(
    screen.getByLabelText("show relevant relations of My second quote")
  );
  const firstQuotes = await screen.findAllByText("My first quote");
  expect(firstQuotes).toHaveLength(3);
  fireEvent.click(screen.getAllByLabelText("edit My first quote")[0]);
  userEvent.keyboard(
    "{backspace}{backspace}{backspace}{backspace}{backspace}edited quote{enter}"
  );
  fireEvent.click(screen.getByLabelText("save"));
  expect(screen.queryByText("Save")).toBeNull();
  const editedFirstQuotes = await screen.findAllByText("My first edited quote");
  expect(editedFirstQuotes).toHaveLength(3);
  expect(screen.queryByText("My first quote")).toBeNull();
});

test("Delete node", async () => {
  const knowledgeDB = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);
  const source = newRepo(newNode("My source", "TITLE"), "source-id");
  const firstNote = newRepo(newNode("My first note", "NOTE"), "first-note-id");

  const nodes = Map<Repo>({
    [source.id]: newRepo(
      addRelationToNode(getNode(source), firstNote.id, "CONTAINS"),
      source.id
    ),
    [firstNote.id]: firstNote,
  });

  const addToWorkspace = updateNode(
    knowledgeDB.repos.merge(nodes),
    knowledgeDB.views,
    { root: TEST_WORKSPACE_ID, indexStack: List<number>() },
    (workspace, ctx) =>
      addRelationToNode(workspace, source.id, ctx.view.relationType)
  );

  await renderKnowledgeApp({
    ...knowledgeDB,
    ...addToWorkspace,
  });
  await screen.findByText("My source", { exact: false });
  fireEvent.click(screen.getByLabelText("show contained nodes of My source"));
  await screen.findByText("My first note");
  fireEvent.click(screen.getByLabelText("edit My first note"));
  const deleteButton = (await screen.findAllByLabelText("delete node"))[1];
  fireEvent.click(deleteButton);
  expect(screen.queryByText("My first note")).toBeNull();
});
