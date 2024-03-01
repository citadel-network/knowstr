import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setup, ALICE, renderApp, typeNewNode } from "../utils.test";

test("Publishing Status is shown per relay", async () => {
  const [alice] = setup([ALICE]);
  const view = renderApp(alice());
  await typeNewNode(view, "New Note");
  const publishingStatusBtn = screen.getByLabelText("publishing status");
  userEvent.click(publishingStatusBtn);
  await screen.findByText("Publishing Status");
  screen.getByText("Relay wss://relay.damus.io/:");
  expect(
    screen.getAllByText(
      "100% of the last 3 events could be published on this relay"
    )
  ).toHaveLength(4);
});
