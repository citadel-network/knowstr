import React, { useState } from "react";
import { Spinner } from "react-bootstrap";
import { Button } from "./Ui";

export type LoadingSpinnerBtnProps = {
  children?: React.ReactNode;
  onClick?: () => Promise<void>;
  afterOnClick?: () => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  type?: "submit" | "button";
};

export function LoadingSpinnerButton({
  children,
  onClick,
  afterOnClick,
  className,
  disabled,
  ariaLabel,
  type,
}: LoadingSpinnerBtnProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const submit = async (): Promise<void> => {
    if (onClick) {
      setLoading(true);
      await onClick();
      setLoading(false);
      if (afterOnClick !== undefined) {
        afterOnClick();
      }
    }
  };
  if (loading) {
    return <Spinner animation="border" role="status" />;
  }
  return (
    <Button
      className={className}
      ariaLabel={ariaLabel}
      onClick={submit}
      disabled={disabled}
      type={type}
    >
      {children}
    </Button>
  );
}
