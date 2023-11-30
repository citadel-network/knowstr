import React from "react";

export type ToggleArrowButtonProps = {
  expanded: boolean;
  onToggle: (expand: boolean) => void;
  ariaLabel?: string;
};

export function ToggleArrowButton({
  expanded,
  onToggle,
  ariaLabel,
  children,
}: ToggleArrowButtonProps & { children?: React.ReactNode }): JSX.Element {
  const aria = ariaLabel
    ? `${expanded ? `collapse` : `expand`} ${ariaLabel}`
    : undefined;
  return (
    <button
      type="button"
      onClick={() => onToggle(!expanded)}
      className="toggle-button"
      aria-label={aria}
    >
      {!expanded && <span className="simple-icon-arrow-right" />}
      {expanded && <span className="simple-icon-arrow-down" />}
      {children && children}
    </button>
  );
}
