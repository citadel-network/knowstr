import React, { CSSProperties } from "react";
import { Badge as BSBadge, Card } from "react-bootstrap";
import { Link } from "react-router-dom";

export type Children = {
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
            <BSBadge
              aria-label={ariaLabel}
              pill
              bg="red"
              className="mb-1"
              style={{ fontSize: `${size || 55}%` }}
            >
              {value}
            </BSBadge>
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
      <div className="flex-col max-height-100">{children}</div>
    </div>
  );
}

export function UIColumnBody({ children }: Children): JSX.Element {
  return (
    <div className="flex-col overflow-y-auto overflow-x-hidden height-100">
      {children}
    </div>
  );
}

export function UIColumnHeader({ children }: Children): JSX.Element {
  return <div className="outer-node-title">{children}</div>;
}

export function UIColumnContent({ children }: Children): JSX.Element {
  return <div className="overflow-y-auto">{children}</div>;
}

export function UIColumnFooter({ children }: Children): JSX.Element {
  return <div className="add-to-node">{children}</div>;
}

export function UINode({
  children,
}: {
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="inner-node">
      <Card.Body className="p-2 pb-2 pt-4 d-flex flex-column justify-content-between h-100">
        {children && children}
      </Card.Body>
    </div>
  );
}

export function UINodeTitle({ children }: Children): JSX.Element {
  return (
    <div className="font-size-big mb-2">
      <span className="pe-2">{children}</span>
    </div>
  );
}

export function UINodeBody({ children }: Children): JSX.Element {
  return (
    <div className="mb-0 h-100">
      <div className="mb-4">{children}</div>
    </div>
  );
}

export function UINodeFooter({ children }: Children): JSX.Element {
  return (
    <div className="mb-2 d-flex justify-content-between align-items-center">
      {children}
    </div>
  );
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

export type BtnProps = {
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

export function OptionalLink({
  children,
  link,
}: Children & { link?: string }): JSX.Element {
  if (link) {
    return (
      <Link className="no-underline" to={link}>
        {children && children}
      </Link>
    );
  }
  return <>{children && children}</>;
}
