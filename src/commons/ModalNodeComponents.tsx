import React from "react";
import { Modal } from "react-bootstrap";
import { Children } from "./Ui";

type ModalNodeProps = {
  children?: React.ReactNode;
  onHide?: () => void;
  ariaLabel?: string;
};

const ModalContext = React.createContext<boolean>(false);

export function ModalNode({
  children,
  onHide,
  ariaLabel,
}: ModalNodeProps): JSX.Element {
  return (
    <ModalContext.Provider value>
      <Modal size="xl" show onHide={onHide} aria-label={ariaLabel}>
        {children}
      </Modal>
    </ModalContext.Provider>
  );
}

export function ModalNodeTitle({ children }: Children): JSX.Element {
  return <Modal.Body className="flex-row-space-between">{children}</Modal.Body>;
}

type ModalNodeBodyProps = {
  children?: React.ReactNode;
  className?: string;
};

export function ModalNodeBody({
  className,
  children,
}: ModalNodeBodyProps): JSX.Element {
  return <Modal.Body className={className}>{children}</Modal.Body>;
}
