import { screen, fireEvent, waitFor } from "@testing-library/react";
import {
  ALICE,
  matchSplitText,
  renderApp,
  setup,
  typeNewNode,
} from "../utils.test";

test("Bionic Reading", async () => {
  const [alice] = setup([ALICE]);

  const utils = renderApp(alice());
  await typeNewNode(utils, "My first quote");

  await screen.findByText("My first quote");
  fireEvent.click(screen.getByLabelText("open menu"));
  fireEvent.click(await screen.findByLabelText("switch bionic reading on"));
  await waitFor(() => {
    expect(screen.queryByText("My first quote")).toBeNull();
  });
  expect(screen.getByText(matchSplitText("My first quote")).innerHTML).toBe(
    "<b>M</b>y <b>fi</b>rst <b>qu</b>ote"
  );
});
