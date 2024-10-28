import React from "react";
import { Alert } from "react-bootstrap";

type ErrorMessageProps = {
  error: string | null;
  setError: (error: string | null) => void;
};

export function ErrorMessage({
  error,
  setError,
}: ErrorMessageProps): JSX.Element {
  return (
    <>
      {error !== null && (
        <Alert
          variant="danger"
          dismissible
          onClose={(): void => setError(null)}
        >
          {error}
        </Alert>
      )}
    </>
  );
}
