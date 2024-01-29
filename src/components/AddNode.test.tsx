import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addRelationToRelations, newNode } from "../connections";
import {
  setup,
  ALICE,
  BOB,
  connectContacts,
  matchSplitText,
  renderApp,
  typeNewNode,
} from "../utils.test";
import { execute } from "../executor";
import { createPlan, planUpsertNode, planUpsertRelations } from "../planner";
import { newRelations } from "../ViewContext";

test("Add New Note", async () => {
  const [alice] = setup([ALICE]);
  const view = renderApp(alice());
  await typeNewNode(view, "Hello World");
});

test("Link Nodes from other Users", async () => {
  const [alice, bob] = setup([ALICE, BOB]);
  await connectContacts(alice, bob);

  const oop = newNode("Object Oriented Languages", bob().user.publicKey);
  const java = newNode("Java", bob().user.publicKey);
  const relations = addRelationToRelations(
    newRelations(oop.id, "" as ID, bob().user.publicKey),
    java.id
  );
  const plan = planUpsertRelations(
    planUpsertNode(planUpsertNode(createPlan(bob()), oop), java),
    relations
  );
  await execute({
    ...bob(),
    plan,
  });
  const view = renderApp({ ...alice(), includeFocusContext: true });
  await typeNewNode(view, "Programming Languages");
  const searchButton = screen.getByLabelText(
    "search and attach to Programming Languages"
  );
  fireEvent.click(searchButton);
  const searchInput = await screen.findByLabelText("search input");
  userEvent.type(searchInput, "Object");
  fireEvent.click(
    await screen.findByText(matchSplitText("Object Oriented Languages"))
  );
  // Open the relations
  fireEvent.click(
    await screen.findByLabelText(
      "show Default items of Object Oriented Languages"
    )
  );
  await screen.findByText("Java");
});
