import React from "react";
import deedsats from "./assets/img/deedsats-transparent.png";

export function DeedsatsLogo({
  styles,
}: {
  styles: React.CSSProperties;
}): JSX.Element {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  return <img src={deedsats} style={styles} alt="Deedsats" />;
}
