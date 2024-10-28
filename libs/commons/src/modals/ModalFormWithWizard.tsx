import React, { useEffect, useRef, useState } from "react";
import { Modal, Form, Button } from "react-bootstrap";
import { ErrorMessage } from "../components/ErrorMessage";
import { createValidateHandler } from "./modalFormValidateHandler";
import { createSubmitHandler } from "./modalFormSubmitHandler";

type WizardModalFormProps = {
  firstStep: React.ReactNode;
  secondStep: React.ReactNode;
  onHide: () => void;
  title: string;
  validate: (form: HTMLFormElement) => void;
  submit: (form: HTMLFormElement) => Promise<void>;
  formRef?: React.Ref<HTMLFormElement>;
};

export function WizardModalForm({
  firstStep,
  secondStep,
  onHide,
  title,
  validate,
  submit,
  formRef,
}: WizardModalFormProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const componentIsMounted = useRef(true);
  useEffect(() => {
    return () => {
      // eslint-disable-next-line functional/immutable-data
      componentIsMounted.current = false;
    };
  }, []);

  const [showSecondStep, setShowSecondStep] = useState(false);
  const onValidate = createValidateHandler({
    setError,
    validate,
  });
  const onSubmit = createSubmitHandler({
    onHide,
    setError,
    submit,
    setLoading: (l: boolean) => {
      if (componentIsMounted.current) {
        setLoading(l);
      }
    },
  });
  return (
    <Modal show onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={onSubmit} ref={formRef} id="giftrequestform">
        <Modal.Body>
          <ErrorMessage error={error} setError={setError} />
          {!showSecondStep && (
            <div className="wizard-basic-step">{firstStep}</div>
          )}
          {showSecondStep && (
            <div className="wizard-basic-step">{secondStep}</div>
          )}
          <Modal.Footer>
            <Button variant="outline-dark" className="me-auto" onClick={onHide}>
              Abort
            </Button>
            <div className="wizard-buttons">
              {showSecondStep && (
                <Button
                  color="primary"
                  className="me-1"
                  onClick={(): void => setShowSecondStep(false)}
                >
                  Back
                </Button>
              )}
              {!showSecondStep && (
                <Button
                  color="primary"
                  className="me-1"
                  type="button"
                  onClick={(event: React.MouseEvent<HTMLElement>): void => {
                    onValidate({
                      event,
                      next: () => {
                        setShowSecondStep(true);
                      },
                    });
                  }}
                >
                  Next
                </Button>
              )}
              {showSecondStep &&
                (loading ? (
                  <div className="spinner-border text-success" role="status" />
                ) : (
                  <Button variant="success" type="submit">
                    Confirm
                  </Button>
                ))}
            </div>
          </Modal.Footer>
        </Modal.Body>
      </Form>
    </Modal>
  );
}
