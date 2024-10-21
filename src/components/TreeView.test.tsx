import React from "react";
import { List, Map } from "immutable";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ALICE,
  BOB,
  CAROL,
  createExampleProject,
  findNodeByText,
  follow,
  planUpsertProjectNode,
  renderWithTestData,
  setup,
  setupTestDB,
} from "../utils.test";
import Data from "../Data";
import { LoadNode } from "../dataQuery";
import { RootViewContextProvider } from "../ViewContext";
import { TreeView } from "./TreeView";
import { execute } from "../executor";
import { createPlan, planUpsertMemberlist } from "../planner";

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

test("Load Social Nodes", async () => {
  const [alice, bob] = setup([ALICE, BOB]);
  await follow(alice, bob().user.publicKey);
  const aliceDB = await setupTestDB(alice(), [
    ["Alice Workspace", [["Money", ["Bitcoin"]]]],
  ]);
  const bitcoin = findNodeByText(aliceDB, "Bitcoin") as KnowNode;
  const aliceWs = findNodeByText(aliceDB, "Alice Workspace") as KnowNode;

  await setupTestDB(bob(), [
    [bitcoin, ["Censorship Resistance", "Electronic Cash"]],
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
  await userEvent.click(
    screen.getByLabelText("show items created by contacts of Bitcoin")
  );
  await screen.findByText("Censorship Resistance");
  await screen.findByText("Electronic Cash");
});

test("Show Relations project Members created", async () => {
  const [alice, bob, carol] = setup([ALICE, BOB, CAROL]);
  const project = createExampleProject(CAROL.publicKey);
  await execute({
    ...carol(),
    plan: planUpsertProjectNode(createPlan(carol()), project),
  });
  await execute({
    ...carol(),
    plan: planUpsertMemberlist(
      createPlan(carol()),
      Map<PublicKey, Member>({
        [ALICE.publicKey]: {
          ...ALICE,
          votes: 10000,
        },
        [BOB.publicKey]: {
          ...BOB,
          votes: 10000,
        },
      })
    ),
  });
  const aliceDB = await setupTestDB(alice(), [
    ["Alice Workspace", [["Money", ["Bitcoin"]]]],
  ]);
  const bitcoin = findNodeByText(aliceDB, "Bitcoin") as KnowNode;
  const aliceWs = findNodeByText(aliceDB, "Alice Workspace") as KnowNode;

  await setupTestDB(bob(), [
    [bitcoin, ["Censorship Resistance", "Electronic Cash"]],
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
      initialRoute: `/w/${aliceWs.id}?project=${project.id}`,
    }
  );
  await screen.findByText("Bitcoin");
  await userEvent.click(
    screen.getByLabelText("show items created by contacts of Bitcoin")
  );
  await screen.findByText("Censorship Resistance");
  await screen.findByText("Electronic Cash");
});
