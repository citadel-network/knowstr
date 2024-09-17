import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ALICE,
  ALICE_PRIVATE_KEY,
  ANON,
  BOB,
  CAROL,
  findNodeByText,
  renderApp,
  setup,
  setupTestDB,
} from "../utils.test";

test("Create a new Workspace", async () => {
  const [alice] = setup([ALICE]);
  const { relayPool } = renderApp(alice());
  const switchWsBtn = await screen.findByLabelText("switch workspace");
  await userEvent.click(switchWsBtn);
  const newWsBtn = screen.getByText("New Workspace");
  fireEvent.click(newWsBtn);
  await userEvent.type(
    screen.getByLabelText("title of new workspace"),
    "My Brand New Workspace"
  );
  await userEvent.click(screen.getByText("Create Workspace"));
  await waitFor(() => {
    // One to create the Node, one to add it to workspaces
    expect(relayPool.getEvents()).toHaveLength(2);
  });
  await screen.findAllByText("My Brand New Workspace");
  screen.getByLabelText("search and attach to My Brand New Workspace");
});

test("Load Fallback Workspace if user is not logged in", async () => {
  const [anon, bob] = setup([ANON, BOB]);
  const bobsDB = await setupTestDB(bob(), [["Bobs Workspace", ["Bitcoin"]]]);
  const wsNode = findNodeByText(bobsDB, "Bobs Workspace") as KnowNode;
  renderApp({ ...anon(), defaultWorkspace: wsNode.id });
  await screen.findByText("Bobs Workspace");
  await screen.findByText("Bitcoin");

  await userEvent.click(screen.getByLabelText("switch workspace"));
  expect(screen.getAllByText("Bobs Workspace").length).toBe(2);
});

test("Remember active Workspace through Route changes", async () => {
  const [anon, bob, carol, alice] = setup([ANON, BOB, CAROL, ALICE]);
  const bobsDB = await setupTestDB(bob(), [["Bobs Workspace", ["Bitcoin"]]]);
  const carolDB = await setupTestDB(carol(), [
    ["Carols Workspace", ["Bitcoin"]],
  ]);
  const wsNode = findNodeByText(bobsDB, "Bobs Workspace") as KnowNode;
  const defaultWs = findNodeByText(carolDB, "Carols Workspace") as KnowNode;
  renderApp({
    ...anon(),
    defaultWorkspace: defaultWs.id,
    initialRoute: `/w/${wsNode.id}`,
  });
  await screen.findByText("Bobs Workspace");
  await userEvent.click(await screen.findByLabelText("sign in"));
  await userEvent.type(
    await screen.findByPlaceholderText(
      "nsec, private key or mnemonic (12 words)"
    ),
    ALICE_PRIVATE_KEY
  );
  await userEvent.click(screen.getByText("Continue"));
  await screen.findByText("Bobs Workspace");

  // User is logged in
  expect(screen.queryByText("sign in")).toBeNull();
  await userEvent.click(screen.getByLabelText("switch workspace"));
  expect(screen.getAllByText("Bobs Workspace").length).toBe(2);

  // don't remember workspace if there are no unsaved changes
  cleanup();
  // reload the app
  renderApp({
    ...alice(),
    defaultWorkspace: defaultWs.id,
  });
  await screen.findByText("Carols Workspace");
});

test("Create New Workspace as fallback", async () => {});
