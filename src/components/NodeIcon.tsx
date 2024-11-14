import React from "react";
import { DeedsatsLogo } from "../DeedsatsLogo";

export function NodeIcon({ node }: { node: KnowNode }): JSX.Element | null {
  if (node.type === "project") {
    return (
      <DeedsatsLogo
        styles={{
          maxHeight: "40px",
          position: "relative",
          top: "-5px",
          marginRight: "5px",
        }}
      />
    );
  }
  return null;
}
