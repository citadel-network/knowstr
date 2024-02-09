import React from "react";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithTestData,
  setup,
  ALICE,
  BOB,
  expectTextContent,
  addContact,
} from "../utils.test";
import { SelectWorkspaces } from "./SelectWorkspaces";

test("Distinguish between local and remote dashboards", async () => {
  const [alice, bob] = setup([ALICE, BOB]);
  await addContact(alice, bob().user.publicKey);

  renderWithTestData(<SelectWorkspaces />, bob());
  const switchWsBtn = await screen.findByLabelText("switch workspace");
  userEvent.click(switchWsBtn);
  const newWsBtn = screen.getByText("New Workspace");
  userEvent.click(newWsBtn);
  userEvent.type(
    screen.getByLabelText("title of new workspace"),
    "Bobs Workspace"
  );
  userEvent.click(screen.getByText("Create Workspace"));

  cleanup();
  renderWithTestData(<SelectWorkspaces />, alice());
  userEvent.click(await screen.findByLabelText("switch workspace"));
  await waitFor(() => {
    const selection = screen.getByLabelText("workspace selection");
    expectTextContent(selection, [
      "Your Workspaces",
      "My first Workspace",
      "Your Contacts Workspaces",
      "Bobs Workspace",
      "New Workspace",
    ]);
  });
});
