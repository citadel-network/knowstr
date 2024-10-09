import React from "react";

export function NodeIcon({ node }: { node: KnowNode }): JSX.Element | null {
  if (node.type === "project") {
    return <span className="iconsminds-chrysler-building" />;
  }
  return null;
}
