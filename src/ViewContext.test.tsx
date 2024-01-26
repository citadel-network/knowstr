import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Data from "./Data";
import {
  newNode,
  addRelationToRelations,
  bulkAddRelations,
  joinID,
} from "./connections";
import { execute } from "./executor";
import {
  createPlan,
  planBulkUpsertNodes,
  planUpsertRelations,
} from "./planner";
import { renderWithTestData, ALICE, setup } from "./utils.test";
import { newRelations } from "./ViewContext";
import { WorkspaceView } from "./components/Workspace";

test("Move View Settings on Delete", async () => {
  const [alice] = setup([ALICE]);
  const { publicKey } = alice().user;

  const c = newNode("C", publicKey);
  const cpp = newNode("C++", publicKey);
  const java = newNode("Java", publicKey);
  const pl = newNode("Programming Languages", publicKey);

  const planWithNodes = planBulkUpsertNodes(createPlan(alice()), [
    c,
    cpp,
    java,
    pl,
  ]);

  const wsRelations = addRelationToRelations(
    newRelations(joinID(publicKey, "my-first-workspace"), "", publicKey),
    pl.id
  );
  const planWithRelations = planUpsertRelations(
    planUpsertRelations(
      planUpsertRelations(
        planWithNodes,
        bulkAddRelations(newRelations(pl.id, "", publicKey), [c.id, java.id])
      ),
      wsRelations
    ),
    addRelationToRelations(newRelations(c.id, "", publicKey), cpp.id)
  );

  await execute({
    ...alice(),
    plan: planWithRelations,
  });

  renderWithTestData(
    <Data user={alice().user}>
      <WorkspaceView />
    </Data>,
    alice()
  );
  fireEvent.click(await screen.findByLabelText("show Default items of C"));
  await screen.findByText("C++");
  // Remove JAVA Node
  userEvent.click(
    screen.getByLabelText("toggle multiselect Programming Languages")
  );
  userEvent.click(screen.getByLabelText("select Java"));
  userEvent.click(screen.getByLabelText("disconnect 1 selected nodes"));
  // Ensure C is still expanded
  await screen.findByText("C++");
  screen.getByLabelText("hide Default items of C");

  userEvent.click(screen.getByLabelText("hide Default items of C"));
  screen.getByLabelText("show Default items of C");
  expect(screen.queryByText("C++")).toBeNull();
});
