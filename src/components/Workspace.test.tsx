import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ALICE,
  ALICE_PRIVATE_KEY,
  ANON,
  BOB,
  CAROL,
  expectTextContent,
  findNodeByText,
  follow,
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

test("Delete Workspace", async () => {
  const [alice] = setup([ALICE]);
  // create two Workspaces
  const aliceDBWithFirstWS = await setupTestDB(alice(), [["First Workspace"]], {
    activeWorkspace: "First Workspace",
  });
  await setupTestDB(
    { ...alice(), ...aliceDBWithFirstWS },
    [["Bitcoin Workspace"]],
    { activeWorkspace: "Bitcoin Workspace" }
  );
  cleanup();
  renderApp(alice());
  await screen.findByText("Bitcoin Workspace");
  await userEvent.click(await screen.findByLabelText("delete node"));
  // correct Workspace title is displayed
  await screen.findByText("First Workspace");
});

test("Can't delete the default workspace if not logged in", async () => {
  const [anon, bob] = setup([ANON, BOB]);
  const bobsDB = await setupTestDB(bob(), [["Default Workspace"]]);
  const defaultWs = findNodeByText(bobsDB, "Default Workspace") as KnowNode;

  renderApp({ ...anon(), defaultWorkspace: defaultWs.id });
  await screen.findByText("Default Workspace");
  // Can't delete the default workspace if not logged in
  expect(screen.queryByLabelText("delete node")).toBeNull();

  // Can delete the default workspace after logged in
  await userEvent.click(await screen.findByLabelText("sign in"));
  await userEvent.type(
    await screen.findByPlaceholderText(
      "nsec, private key or mnemonic (12 words)"
    ),
    ALICE_PRIVATE_KEY
  );
  await userEvent.click(screen.getByText("Continue"));
  await screen.findByText("Default Workspace");
  await screen.findByLabelText("delete node");
});

test("Workspace deleted by a contact is still shown", async () => {
  const [alice, bob, carol] = setup([ALICE, BOB, CAROL]);
  await follow(alice, bob().user.publicKey);
  await follow(bob, alice().user.publicKey);
  await follow(carol, alice().user.publicKey);
  await follow(carol, bob().user.publicKey);

  await setupTestDB(alice(), [["Alice Workspace"]], {
    activeWorkspace: "Alice Workspace",
  });

  cleanup();
  renderApp(alice());
  await screen.findByText("Alice Workspace");

  // Bob deletes Alice Workspace and can't see it anymore
  cleanup();
  renderApp(bob());
  await userEvent.click(await screen.findByLabelText("switch workspace"));
  await waitFor(() => {
    const selection = screen.getByLabelText("workspace selection");
    expectTextContent(selection, [
      "Your Workspaces",
      "My first Workspace",
      "Your Contacts Workspaces",
      "Alice Workspace",
      "New Workspace",
    ]);
  });
  await userEvent.click(screen.getByText("Alice Workspace"));
  await userEvent.click(await screen.findByLabelText("delete node"));
  await screen.findAllByText("My first Workspace");

  // Carol can see Alice Workspace because neither she nor the author Alice deleted it
  cleanup();
  renderApp(carol());
  await userEvent.click(await screen.findByLabelText("switch workspace"));
  await waitFor(() => {
    const selection = screen.getByLabelText("workspace selection");
    expectTextContent(selection, [
      "Your Workspaces",
      "My first Workspace",
      "Your Contacts Workspaces",
      "Alice Workspace",
      "New Workspace",
    ]);
  });

  // Alice deletes the Workspace and can't see it anymore
  cleanup();
  renderApp(alice());
  await screen.findByText("Alice Workspace");
  await userEvent.click(await screen.findByLabelText("delete node"));
  await screen.findAllByText("My first Workspace");

  // Carol can't see Alice Workspace anymore
  cleanup();
  renderApp(carol());
  await userEvent.click(await screen.findByLabelText("switch workspace"));
  await waitFor(() => {
    const selection = screen.getByLabelText("workspace selection");
    expectTextContent(selection, [
      "Your Workspaces",
      "My first Workspace",
      "Your Contacts Workspaces",
      "My first Workspace",
      "New Workspace",
    ]);
  });
});
