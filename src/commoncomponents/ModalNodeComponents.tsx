import React from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "react-bootstrap";
import { Button, Children, BtnProps } from "./Ui";

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

export function useIsModal(): boolean {
  return React.useContext(ModalContext);
}

export function ModalNodeTitle({ children }: Children): JSX.Element {
  return <Modal.Body className="flex-row-space-between">{children}</Modal.Body>;
}

export function ModalNodeHeader({ children }: Children): JSX.Element {
  return (
    <Modal.Header closeButton className="node-detail-header p-0">
      {children}
    </Modal.Header>
  );
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

export function ModalNodeFooter({ children }: Children): JSX.Element {
  return <div className="p-1">{children}</div>;
}

type ModalNodeTitleTextProps = {
  width?: number;
  children?: React.ReactNode;
};

export function ModalNodeTitleText({
  width,
  children,
}: ModalNodeTitleTextProps): JSX.Element {
  return (
    <div className={`w-${width || "90"} modal-node-title flex-col`}>
      {children}
    </div>
  );
}

type ModalNodeTitleMenuBtnProps = {
  deleteOrReduceButtonProps?: BtnProps & { caption?: string };
  editButtonProps?: BtnProps & { caption?: string };
};

export function ModalNodeTitleMenuBtns({
  deleteOrReduceButtonProps,
  editButtonProps,
}: ModalNodeTitleMenuBtnProps): JSX.Element {
  return (
    <>
      {deleteOrReduceButtonProps !== undefined && (
        <Button
          className="mb-2 btn"
          ariaLabel={deleteOrReduceButtonProps.ariaLabel}
          onClick={deleteOrReduceButtonProps.onClick}
        >
          {deleteOrReduceButtonProps.caption === "Delete" && (
            <span className="simple-icon-trash" />
          )}
          <span className="ms-2">
            {deleteOrReduceButtonProps.caption || "Delete"}{" "}
          </span>
        </Button>
      )}
      {editButtonProps !== undefined && (
        <Button
          className="mb-2 btn"
          ariaLabel={editButtonProps.ariaLabel}
          onClick={editButtonProps.onClick}
        >
          {editButtonProps.caption === "Edit" && (
            <span className="simple-icon-pencil" />
          )}
          <span className="ms-2">{editButtonProps.caption || "Edit"} </span>
        </Button>
      )}
    </>
  );
}

type ModalNodeTitleMenuProps = {
  children: React.ReactNode;
};

export function ModalNodeTitleMenu({
  children,
}: ModalNodeTitleMenuProps): JSX.Element {
  return (
    <div className="modal-node-title-menu w-20 flex-col-100 ms-3 mt-3">
      {children}
    </div>
  );
}

export function DetailModal({
  children,
  ariaLabel,
}: {
  children: React.ReactNode;
  ariaLabel: string;
}): JSX.Element {
  const navigate = useNavigate();
  const onHide = (): void => {
    navigate(`/`);
  };
  return (
    <ModalNode onHide={onHide} ariaLabel={ariaLabel}>
      {children}
      <ModalNodeFooter />
    </ModalNode>
  );
}

export function DetailTitle({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <ModalNodeTitle>
      <ModalNodeTitleText width={100}>{children}</ModalNodeTitleText>
    </ModalNodeTitle>
  );
}
