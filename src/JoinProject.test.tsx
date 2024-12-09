import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outlet } from "react-router-dom";
import {
  ALICE,
  createExampleProject,
  planUpsertProjectNode,
  renderWithTestData,
  setup,
} from "./utils.test";
import { execute } from "./executor";
import { createPlan } from "./planner";
import { JoinProjectButton } from "./JoinProjext";
import { RootViewContextProvider } from "./ViewContext";
import { TemporaryViewProvider } from "./components/TemporaryViewContext";
import { DND } from "./dnd";
import { LoadNode } from "./dataQuery";

test("Join Project", async () => {
  const [alice] = setup([ALICE]);
  const project = createExampleProject(alice().user.publicKey);
  await execute({
    ...alice(),
    plan: planUpsertProjectNode(createPlan(alice()), project),
  });
  renderWithTestData(
    <RootViewContextProvider root={project.id}>
      <TemporaryViewProvider>
        <DND>
          <LoadNode>
            <Outlet />
            <JoinProjectButton />
          </LoadNode>
        </DND>
      </TemporaryViewProvider>
    </RootViewContextProvider>,
    alice()
  );
  await userEvent.click(await screen.findByText("Join Project"));
  await screen.findByText("Waiting for Approval");
});
