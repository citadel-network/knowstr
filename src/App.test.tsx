import { screen } from "@testing-library/react";
import { ALICE, renderApp, setup } from "./utils.test";

test("show login screen if user is logged out", async () => {
  const [alice] = setup([ALICE]);
  const utils = await alice();
  renderApp({
    ...utils,
    user: undefined,
  });
  screen.getByText("Sign In");
});

// TODO: create tests where users see it's others notes
