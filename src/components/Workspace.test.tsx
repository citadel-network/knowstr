import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ALICE, renderApp, setup } from "../utils.test";

test("Create a new Workspace", async () => {
  const [alice] = setup([ALICE]);
  const { relayPool } = renderApp(alice());
  const switchWsBtn = await screen.findByLabelText("switch workspace");
  userEvent.click(switchWsBtn);
  const newWsBtn = screen.getByText("New Workspace");
  fireEvent.click(newWsBtn);
  userEvent.type(
    screen.getByLabelText("title of new workspace"),
    "My Brand New Workspace"
  );
  userEvent.click(screen.getByText("Create Workspace"));
  await waitFor(() => {
    // One to create the Node, one to add it to workspaces
    expect(relayPool.getEvents()).toHaveLength(2);
  });
  await screen.findAllByText("My Brand New Workspace");
  screen.getByLabelText("search and attach to My Brand New Workspace");
});
