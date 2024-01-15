import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { createPlan, planSetKnowledgeData } from "../planner";
import { execute } from "../executor";
import {
  connectContacts,
  createDefaultKnowledgeTestData,
  renderWithTestData,
  setup,
  ALICE,
  BOB,
  expectTextContent,
  commitAll,
} from "../utils.test";
import { SelectWorkspaces } from "./SelectWorkspaces";
import { compareKnowledgeDB } from "../knowledgeEvents";
import { newDB } from "../knowledge";

test("Distinguish between local and remote dashboards", async () => {
  const [alice, bob] = setup([ALICE, BOB]);
  await connectContacts(alice, bob);
  await execute({
    ...bob(),
    plan: planSetKnowledgeData(
      createPlan(bob()),
      compareKnowledgeDB(
        newDB(),
        commitAll(createDefaultKnowledgeTestData("bobs-ws", "Bobs Workspace"))
      )
    ),
  });

  await execute({
    ...alice(),
    plan: planSetKnowledgeData(
      createPlan(alice()),
      compareKnowledgeDB(
        newDB(),
        commitAll(createDefaultKnowledgeTestData("alice-ws", "Alice Workspace"))
      )
    ),
  });

  renderWithTestData(<SelectWorkspaces />, alice());

  fireEvent.click(await screen.findByLabelText("switch workspace"));
  const selection = await screen.findByLabelText("workspace selection");
  expectTextContent(selection, [
    "Your Workspaces",
    "Alice Workspace",
    "Your Contacts Workspaces",
    "Bobs Workspace",
    "New Workspace",
  ]);
});
