import React from "react";
import { screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { List, Map } from "immutable";
import userEvent from "@testing-library/user-event";
import { addRelationToNode, newNode } from "../connections";
import {
  createDefaultKnowledgeTestData,
  renderKnowledgeApp,
  TEST_WORKSPACE_ID,
  setup,
  ALICE,
  BOB,
  connectContacts,
  renderWithTestData,
  matchSplitText,
  commitAll,
} from "../utils.test";
import { newDB, newRepo } from "../knowledge";
import { updateNode, ViewContextProvider } from "../ViewContext";
import { TemporaryViewProvider } from "./TemporaryViewContext";
import { execute } from "../executor";
import { createPlan, planSetKnowledgeData } from "../planner";
import { Column } from "./Column";
import { DND } from "../dnd";
import { PublishKnowledgeButton } from "./PublishKnowledgeButton";
import { compareKnowledgeDB } from "../knowledgeEvents";

test("Add Summary", async () => {
  const knowledgeDB = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);
  const quote = newRepo(newNode("My first quote", "QUOTE"), "quote-id");
  const nodes = Map<Repo>({
    "source-id": newRepo(
      addRelationToNode(newNode("My source", "TITLE"), "quote-id", "CONTAINS"),
      "source-id"
    ),
    [quote.id]: quote,
  });

  const addToWorkspace = updateNode(
    knowledgeDB.repos.merge(nodes),
    knowledgeDB.views,
    { root: TEST_WORKSPACE_ID, indexStack: List<number>() },
    (workspace, ctx) =>
      addRelationToNode(workspace, "source-id", ctx.view.relationType)
  );

  await renderKnowledgeApp({
    ...knowledgeDB,
    ...addToWorkspace,
  });
  await screen.findByText("My first quote");
  fireEvent.click(
    await screen.findByLabelText("show summaries of My first quote")
  );
  fireEvent.click(await screen.findByLabelText("add to My first quote [main]"));
  expect(screen.queryByLabelText("add to My first quote [main]")).toBeNull();
  userEvent.keyboard("My first summary");
  fireEvent.click(await screen.findByText("Add Summary"));
  expect(screen.queryByLabelText("Add Summary")).toBeNull();
  await screen.findByText("My first summary");
});

test("Copy of linked Nodes", async () => {
  const [alice, bob] = setup([ALICE, BOB]);
  await connectContacts(alice, bob);

  // Create some nodes for bob
  const oop = newRepo(
    addRelationToNode(
      newNode("Object Oriented Languages", "TOPIC"),
      "java",
      "RELEVANCE"
    ),
    "oop"
  );
  const java = newRepo(newNode("Java", "TOPIC"), "java");
  const bobsData = commitAll({
    ...createDefaultKnowledgeTestData("bobws"),
    repos: Map<Repo>({
      oop,
      java,
    }),
  });
  await execute({
    ...bob(),
    plan: planSetKnowledgeData(
      createPlan(bob()),
      compareKnowledgeDB(newDB(), bobsData)
    ),
  });

  // Create Alice Data
  const ws = newRepo(
    addRelationToNode(
      newNode("Workspace:#FF00FF", "WORKSPACE"),
      "pl",
      "RELEVANCE"
    ),
    "ws"
  );
  const pl = newRepo(newNode("Programming Languages", "TOPIC"), "pl");
  await execute({
    ...alice(),
    plan: planSetKnowledgeData(
      createPlan(alice()),
      compareKnowledgeDB(
        newDB(),
        commitAll({
          ...createDefaultKnowledgeTestData("ws"),
          repos: Map<Repo>({
            pl,
            ws,
          }),
        })
      )
    ),
  });

  renderWithTestData(
    <TemporaryViewProvider>
      <DND>
        <ViewContextProvider root="ws" indices={List<number>([0])}>
          <Column />
          <PublishKnowledgeButton />
        </ViewContextProvider>
      </DND>
    </TemporaryViewProvider>,
    alice()
  );
  // connect Programming Languages with Bobs Object Oriented Languages
  await screen.findByText("Programming Languages");
  const searchButton = screen.getByLabelText("search");
  fireEvent.click(searchButton);
  const searchInput = await screen.findByLabelText("search input");
  userEvent.type(searchInput, "Object");
  userEvent.click(
    screen.getByText(matchSplitText("Object Oriented Languages"))
  );

  fireEvent.click(
    screen.getByLabelText(
      "show relevant relations of Object Oriented Languages"
    )
  );
  screen.getByText("Java");
  // Store
  userEvent.click(screen.getByLabelText("Save Knowledge"));
  await waitFor(() => {
    expect(screen.queryByLabelText("Save Knowledge")).toBeNull();
  });
  cleanup();
  // Let Bob delete all his nodes
  const diff = compareKnowledgeDB(commitAll(bobsData), newDB());
  await execute({
    ...bob(),
    plan: planSetKnowledgeData(createPlan(bob()), diff),
  });

  // Alice still can see the `Object Oriented Languages` Node, but not it's children (java)
  renderWithTestData(
    <TemporaryViewProvider>
      <DND>
        <ViewContextProvider root="ws" indices={List<number>([0])}>
          <Column />
        </ViewContextProvider>
      </DND>
    </TemporaryViewProvider>,
    alice()
  );
  await screen.findByText("Programming Languages");
  await screen.findByText("Object Oriented Languages");
  // TODO: Theoretically Alice has a Copy of this in her DB
  // but she doesn't see it, becuase the remote branch which is set in
  // the view is not available anymore because Bob deleted it. We could
  // introduce a Feature where we store the last commit hash of a remote
  // so we can find it again.
  expect(screen.queryByText("Java")).toBeNull();
  expect(screen.getByText("Error: Node not found"));
});
