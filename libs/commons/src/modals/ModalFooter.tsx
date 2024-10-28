import React from "react";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";

type ModalFooterProps = {
  onHide: () => void;
  loading: boolean;
  SubmitButton?: () => JSX.Element;
};

export function ModalFooter({
  onHide,
  loading,
  SubmitButton,
}: ModalFooterProps): JSX.Element {
  const Submit =
    SubmitButton ||
    ((): JSX.Element => (
      <Button variant="primary" type="submit">
        Save
      </Button>
    ));

  return (
    <Modal.Footer>
      <Button variant="outline-dark" className="me-auto" onClick={onHide}>
        Cancel
      </Button>
      {loading ? (
        <div
          aria-label="loading"
          className="spinner-border text-success"
          role="status"
        />
      ) : (
        <Submit />
      )}
    </Modal.Footer>
  );
}
