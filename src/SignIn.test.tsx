import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithTestData } from "./utils.test";
import { NostrAuthContextProvider } from "./NostrAuthContext";
import { App } from "./App";

test("Login and logout with seed phrase", async () => {
  renderWithTestData(
    <NostrAuthContextProvider>
      <App />
    </NostrAuthContextProvider>
  );
  userEvent.type(
    await screen.findByLabelText("Sign In"),
    "leader monkey parrot ring guide accident before fence cannon height naive bean{enter}"
  );

  await screen.findByText("My first Workspace", undefined, {
    timeout: 5000,
  });

  fireEvent.click(screen.getByLabelText("open menu"));
  fireEvent.click(screen.getByLabelText("invite user"));
  await screen.findByDisplayValue(
    /17162c921dc4d2518f9a101db33695df1afb56ab82f5ff3e5da6eec3ca5cd917/
  );

  fireEvent.click(await screen.findByLabelText("open menu"));
  const logoutButton = await screen.findByLabelText("logout");
  fireEvent.click(logoutButton);
  await screen.findByLabelText("Sign In");
});

test("Login with nsec", async () => {
  renderWithTestData(
    <NostrAuthContextProvider>
      <App />
    </NostrAuthContextProvider>
  );
  userEvent.type(
    await screen.findByLabelText("Sign In"),
    "nsec10allq0gjx7fddtzef0ax00mdps9t2kmtrldkyjfs8l5xruwvh2dq0lhhkp{enter}"
  );
  fireEvent.click(await screen.findByLabelText("open menu"));
  fireEvent.click(screen.getByLabelText("invite user"));
  await screen.findByDisplayValue(
    /17162c921dc4d2518f9a101db33695df1afb56ab82f5ff3e5da6eec3ca5cd917/
  );
});

test("Login with private key", async () => {
  renderWithTestData(
    <NostrAuthContextProvider>
      <App />
    </NostrAuthContextProvider>
  );
  userEvent.type(
    await screen.findByLabelText("Sign In"),
    "7f7ff03d123792d6ac594bfa67bf6d0c0ab55b6b1fdb6249303fe861f1ccba9a{enter}"
  );
  fireEvent.click(await screen.findByLabelText("open menu"));
  fireEvent.click(screen.getByLabelText("invite user"));
  await screen.findByDisplayValue(
    /17162c921dc4d2518f9a101db33695df1afb56ab82f5ff3e5da6eec3ca5cd917/
  );
});

test("Display Error", async () => {
  renderWithTestData(
    <NostrAuthContextProvider>
      <App />
    </NostrAuthContextProvider>
  );
  userEvent.type(
    await screen.findByLabelText("Sign In"),
    "0000completenonsense{enter}"
  );
  await screen.findByText("Input is not a valid nsec, private key or mnemonic");
});
