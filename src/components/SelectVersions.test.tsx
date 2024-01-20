import React from "react";
import { List, Map, Set } from "immutable";
import userEvent from "@testing-library/user-event";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import {
  addRelationToRelations,
  bulkAddRelations,
  deleteRelations,
  newNode,
} from "../connections";
import { execute } from "../executor";
import {
  addToBranch,
  clone,
  commitAllBranches,
  DEFAULT_BRANCH_NAME,
  ensureLocalBranch,
  newDB,
  newRepo,
} from "../knowledge";
import { createPlan, planSetKnowledgeData } from "../planner";
import {
  ALICE,
  BOB,
  CAROL,
  commitAll,
  connectContacts,
  createDefaultKnowledgeTestData,
  renderWithTestData,
  setup,
  TEST_WORKSPACE_ID,
} from "../utils.test";
import { SelectVersions } from "./SelectVersions";
import { WorkspaceView } from "./Workspace";
import {
  getDefaultView,
  updateNode,
  updateView,
  ViewContextProvider,
} from "../ViewContext";
import { TemporaryViewProvider } from "./TemporaryViewContext";
import { DND } from "../dnd";
import { Column } from "./Column";
import { compareKnowledgeDB } from "../knowledgeEvents";

test("Show relevant Remote Branches", async () => {
  const [alice, bob] = setup([ALICE, BOB]);
  await connectContacts(alice, bob);
  const repo = commitAllBranches(
    newRepo(newNode("Hello World", "NOTE"), "id-1")
  );
  const defaultData = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);
  const knowledgeWithNode = {
    ...defaultData,
    repos: defaultData.repos.set("id-1", repo),
  };
  await execute({
    ...alice(),
    plan: planSetKnowledgeData(
      createPlan(alice()),
      compareKnowledgeDB(newDB(), commitAll(knowledgeWithNode))
    ),
  });

  // bob makes a change
  const bobsVersion = addToBranch(
    ensureLocalBranch(clone(repo, ALICE.publicKey), [
      ALICE.publicKey,
      "main",
    ])[0],
    newNode("Hello World!", "NOTE"),
    "main"
  );
  await execute({
    ...bob(),
    plan: planSetKnowledgeData(
      createPlan(bob()),
      compareKnowledgeDB(
        newDB(),
        commitAll({
          ...defaultData,
          repos: defaultData.repos.set("id-1", bobsVersion),
        })
      )
    ),
  });

  renderWithTestData(
    <TemporaryViewProvider>
      <ViewContextProvider root="id-1">
        <SelectVersions />
      </ViewContextProvider>
    </TemporaryViewProvider>,
    alice()
  );
  userEvent.click(await screen.findByLabelText("select version"));
  // Alice sees Bobs Version
  screen.getByText("1 changes ahead");
});

test("Compare Versions and choose ff", async () => {
  const [alice, bob] = setup([ALICE, BOB]);
  await connectContacts(alice, bob);

  const repos = Map<string, Repo>({
    pl: newRepo(
      bulkAddRelations(
        newNode("Programming Languages", "TOPIC"),
        ["c", "cpp"],
        "RELEVANCE"
      ),
      "pl"
    ),
    c: newRepo(newNode("C", "TOPIC"), "c"),
    cpp: newRepo(newNode("C++", "TOPIC"), "cpp"),
  });
  const defaultTestData = createDefaultKnowledgeTestData(TEST_WORKSPACE_ID);
  const aliceKnowledgeData = {
    ...defaultTestData,
    repos: defaultTestData.repos.merge(repos),
  };

  // Bob clones Alice Repos and adds a node
  const bobsClone = aliceKnowledgeData.repos
    .map((remoteRepo) => clone(remoteRepo as RemoteRepo, ALICE.publicKey))
    .set(
      "js",
      newRepo(newNode("Javascript", "TOPIC"), "js") as RepoWithCommits
    );

  // Bob deletes all relations and adds his own
  const bobsRepos = updateNode(
    bobsClone,
    Map<string, View>(),
    { root: "pl", indexStack: List<number>() },
    (pl, { view }) =>
      addRelationToRelations(
        deleteRelations(pl, Set<number>([0, 1]), view.relationType),
        "js",
        "RELEVANCE"
      )
  );

  await execute({
    ...bob(),
    plan: planSetKnowledgeData(
      createPlan(bob()),
      compareKnowledgeDB(
        newDB(),
        commitAll({
          ...defaultTestData,
          repos: defaultTestData.repos.merge(bobsRepos.repos),
        })
      )
    ),
  });
  // Alice Compares her version to Bobs
  const workspaceWithComparison = updateNode(
    aliceKnowledgeData.repos,
    updateView(
      Map<string, View>(),
      { root: TEST_WORKSPACE_ID, indexStack: List<number>([0]) },
      {
        ...getDefaultView(repos.get("pl") as Repo),
        branch: [BOB.publicKey, DEFAULT_BRANCH_NAME],
      }
    ),
    { root: TEST_WORKSPACE_ID, indexStack: List<number>() },
    (workspace) =>
      addRelationToRelations(
        addRelationToRelations(workspace, "pl", "RELEVANCE"),
        "pl",
        "RELEVANCE"
      )
  );
  await execute({
    ...alice(),
    plan: planSetKnowledgeData(
      createPlan(alice()),
      compareKnowledgeDB(
        newDB(),
        commitAll({
          ...aliceKnowledgeData,
          ...workspaceWithComparison,
        })
      )
    ),
  });
  renderWithTestData(<WorkspaceView />, alice());
  // Add C++ to bobs version
  await screen.findByText("Javascript");
  const searchButtons = screen.getAllByLabelText("search");
  fireEvent.click(searchButtons[0]);
  const searchInput = await screen.findByLabelText("search input");
  userEvent.type(searchInput, "C+");
  fireEvent.click(screen.getByLabelText("select C++"));
  expect(
    screen.getByLabelText("related to Programming Languages [71a2027698-main]")
      .textContent
  ).toEqual("Javascript00C++00 Referenced By (1)");

  // The main version doesn't change
  const nodesList = screen.getByLabelText(
    "related to Programming Languages [main]"
  );
  expect(nodesList.textContent).toEqual("C00C++00 Referenced By (1)");

  fireEvent.click(
    screen.getByLabelText("accept Programming Languages [71a2027698-main]")
  );
  const finalNodesList = (
    await screen.findAllByLabelText("related to Programming Languages [main]")
  )[1];
  expect(finalNodesList.textContent).toEqual(
    "Javascript00C++00 Referenced By (1)"
  );
});

test("Delete View Settings on Branch Change", async () => {
  const [alice, carol] = setup([ALICE, CAROL]);
  await connectContacts(alice, carol);
  // Businesses -> Supermarkets -> Alice Supermarket
  const businesses = commitAllBranches(
    newRepo(
      addRelationToRelations(newNode("Businesses", "TOPIC"), "s", "RELEVANCE"),
      "b"
    )
  );
  const supermarkets = newRepo(
    addRelationToRelations(newNode("Supermarkets", "TOPIC"), "a", "RELEVANCE"),
    "s"
  );
  const aliceSuperMarket = newRepo(newNode("Alice Supermarket", "TOPIC"), "a");

  const ws = addRelationToRelations(
    newNode("WS:#00FF00", "WORKSPACE"),
    "b",
    "RELEVANCE"
  );

  const repos = Map<RepoWithCommits>({
    b: commitAllBranches(businesses),
    s: commitAllBranches(supermarkets),
    a: commitAllBranches(aliceSuperMarket),
    ws: commitAllBranches(newRepo(ws, "ws")),
  });
  const knowledgeData = {
    repos,
    activeWorkspace: "ws",
    views: Map<string, View>(),
  };

  await execute({
    ...alice(),
    plan: planSetKnowledgeData(
      createPlan(alice()),
      compareKnowledgeDB(newDB(), commitAll(knowledgeData))
    ),
  });

  // Carol Deletes Supermarkets and Adds Restaurants instead
  // Businesses -> Restaurants -> Carols Restaurant
  const restaurants = newRepo(
    addRelationToRelations(newNode("Restaurants", "TOPIC"), "c", "RELEVANCE"),
    "r"
  );
  const carolsRestaurant = newRepo(newNode("Carols Restaurant", "NOTE"), "c");
  const carolsClone = knowledgeData.repos
    .map((remoteRepo) => clone(remoteRepo, ALICE.publicKey))
    .set("c", commitAllBranches(carolsRestaurant))
    .set("r", commitAllBranches(restaurants));
  const carolsData = updateNode(
    carolsClone,
    Map<string, View>(),
    { root: "b", indexStack: List<number>() },
    (b, { view }) =>
      addRelationToRelations(
        deleteRelations(b, Set<number>([0]), view.relationType),
        "r",
        "RELEVANCE"
      )
  );
  await execute({
    ...carol(),
    plan: planSetKnowledgeData(
      createPlan(carol()),
      compareKnowledgeDB(
        newDB(),
        commitAll({
          ...knowledgeData,
          ...carolsData,
        })
      )
    ),
  });

  renderWithTestData(
    <ViewContextProvider root="ws" indices={List<number>([0])}>
      <TemporaryViewProvider>
        <DND>
          <Column />
        </DND>
      </TemporaryViewProvider>
    </ViewContextProvider>,
    alice()
  );
  await screen.findByText("Businesses");
  userEvent.click(
    screen.getByLabelText("show relevant relations of Supermarkets")
  );
  screen.getByText("Alice Supermarket");
  screen.getByText("Supermarkets");
  // Collapse first Node of Business
  userEvent.click(
    screen.getByLabelText("hide relevant relations of Supermarkets")
  );
  screen.getByLabelText("show relevant relations of Supermarkets");
  expect(screen.queryByText("Alice Supermarket")).toBeNull();

  // Change version
  userEvent.click(await screen.findByLabelText("select version"));
  await waitFor(() => userEvent.click(screen.getByText("1 changes ahead")));
  // First node, which is now "Restaurants" is not expanded per default
  userEvent.click(
    screen.getByLabelText("show relevant relations of Restaurants")
  );
  screen.getByText("Carols Restaurant");
  screen.getByLabelText("hide relevant relations of Restaurants");
});
