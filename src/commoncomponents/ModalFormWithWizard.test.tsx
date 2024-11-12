import React from "react";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import { WizardModalForm } from "./ModalFormWithWizard";

type TestResult = {
  onHide: () => void;
};

function createTestForm(
  validate: (form: HTMLFormElement) => Promise<void>,
  submit: (form: HTMLFormElement) => Promise<void>,
  firstStep: JSX.Element,
  secondStep: JSX.Element
): TestResult {
  const onHide = jest.fn();
  render(
    <div>
      <WizardModalForm
        firstStep={firstStep}
        secondStep={secondStep}
        onHide={onHide}
        title="Form Title"
        validate={validate}
        submit={submit}
      />
    </div>
  );
  return {
    onHide,
  };
}

test("show error on validate", () => {
  const submit = jest.fn();
  const { onHide } = createTestForm(
    () => {
      throw Error("Something went wrong");
    },
    submit,
    <div />,
    <div />
  );
  const validateButton = screen.getByText("Next");
  fireEvent.click(validateButton);
  screen.getByText("Something went wrong");
  expect(submit).not.toHaveBeenCalled();
  expect(onHide).not.toHaveBeenCalled();
});

test("submit form", async () => {
  const validate = jest.fn();
  const submit = jest.fn();
  const { onHide } = createTestForm(validate, submit, <div />, <div />);
  const validateButton = screen.getByText("Next");
  fireEvent.click(validateButton);
  await waitFor(() => {
    expect(validate).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    expect(onHide).not.toHaveBeenCalled();
  });
  const submitBtn = screen.getByText("Confirm");
  fireEvent.click(submitBtn);
  await waitFor(() => {
    expect(submit).toHaveBeenCalledTimes(1);
    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
