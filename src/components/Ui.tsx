import React, { CSSProperties } from "react";
import { Card, Modal } from "react-bootstrap";
import * as BS from "react-bootstrap";

type Children = {
  children?: React.ReactNode;
};

type BadgeProps = {
  value?: number;
  isLeft?: boolean;
  size?: number;
  ariaLabel?: string;
};

export function Badge({
  value,
  isLeft,
  size,
  ariaLabel,
}: BadgeProps): JSX.Element {
  return (
    <>
      {value !== undefined && value > 0 && (
        <div className="position-relative">
          <div
            className="position-absolute align-top"
            style={
              isLeft
                ? { top: "-20px", left: "-15px", zIndex: 1 }
                : { top: "-17px", right: "-15px", zIndex: 1 }
            }
          >
            <BS.Badge
              aria-label={ariaLabel}
              pill
              bg="red"
              className="mb-1"
              style={{ fontSize: `${size || 55}%` }}
            >
              {value}
            </BS.Badge>
          </div>
        </div>
      )}
    </>
  );
}

export function WorkspaceColumn({
  children,
  columnSpan,
  dataTestId,
}: Children & {
  columnSpan?: number;
  dataTestId?: string;
}): JSX.Element {
  return (
    <div
      className="workspace-column"
      data-testid={dataTestId || "ws-col"}
      style={columnSpan ? { gridColumn: `span ${columnSpan}` } : {}}
    >
      {children}
    </div>
  );
}

export function UIColumn({
  children,
  keyString,
}: Children & {
  keyString?: string;
}): JSX.Element {
  return (
    <div className="mb-2 outer-node flex-col" key={keyString || "outer-node"}>
      <div className="flex-col-100">{children}</div>
    </div>
  );
}

export function UIColumnBody({ children }: Children): JSX.Element {
  return (
    <div className="flex-col overflow-y-auto overflow-x-hidden">{children}</div>
  );
}

export function UIColumnHeader({ children }: Children): JSX.Element {
  return <div className="outer-node-title">{children}</div>;
}

type SelectboxProps = {
  checked: boolean;
  setSelected: (checked: boolean) => void;
  ariaLabel?: string;
};

/* eslint-disable jsx-a11y/label-has-associated-control */
export function Selectbox({
  checked,
  setSelected,
  ariaLabel,
}: SelectboxProps): JSX.Element {
  return (
    <div className="checkbox">
      <div className="pretty p-default p-round font-size-select">
        <input
          type="checkbox"
          aria-label={ariaLabel}
          checked={checked}
          onChange={(e) => {
            setSelected(e.target.checked);
          }}
        />
        <div className="state p-info p-info-o">
          <label />
        </div>
      </div>
    </div>
  );
}

type KnowledgeNodeCardProps = {
  badgeValue?: number;
  style?: CSSProperties | undefined;
  className?: string;
  cardBodyClassName?: string;
};

export function NodeCard({
  children,
  badgeValue,
  style,
  className,
  cardBodyClassName,
}: Partial<Children> & KnowledgeNodeCardProps): JSX.Element {
  return (
    <Card className={`inner-node ${className || ""}`} style={style}>
      <Badge value={badgeValue} isLeft size={80} />
      <Card.Body className={cardBodyClassName || "ps-0 pb-2 pt-2"}>
        <div className="d-flex align-center">{children}</div>
      </Card.Body>
    </Card>
  );
}

type BtnProps = {
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  type?: "button" | "submit";
} & Children;

export function Button({
  children,
  ariaLabel,
  onClick,
  className,
  disabled,
  type,
}: BtnProps): JSX.Element {
  return (
    <button
      disabled={disabled}
      type={type === "submit" ? "submit" : "button"}
      className={className || "btn"}
      onClick={onClick}
      aria-label={ariaLabel}
      tabIndex={0}
    >
      {children && children}
    </button>
  );
}

export function ModalNodeTitle({ children }: ModalNodeChildProps): JSX.Element {
  return <Modal.Body className="flex-row-space-between">{children}</Modal.Body>;
}

type ModalNodeChildProps = {
  children?: React.ReactNode;
};

export function ModalNodeBody({ children }: ModalNodeChildProps): JSX.Element {
  // I want to remove p-0
  return <Modal.Body className="flex-col height-100">{children}</Modal.Body>;
}

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

export function CloseButton({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <button className="btn btn-borderless p-0" type="button" onClick={onClose}>
      <span aria-hidden="true" className="btn-close" />
      <span className="visually-hidden">Close</span>
    </button>
  );
}

export function StandaloneCard({ children }: Children): JSX.Element {
  return (
    <div className="h-100">
      <div id="app-container" className="h-100">
        <main>
          <div className="container">
            <div className="h-100 row">
              <div className="mx-auto my-auto col-12">
                <Card className="auth-card card">
                  <Card.Body className="form-side">{children}</Card.Body>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
