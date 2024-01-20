import React from "react";
import { useParams } from "react-router-dom";
import { ViewContextProvider, useNode } from "../ViewContext";
import { TemporaryViewProvider } from "./TemporaryViewContext";

export function FullScreenViewWrapper({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element | null {
  const { openNodeID: id } = useParams<{
    openNodeID: string;
  }>() as { openNodeID: string };
  const [node] = useNode();
  const root = id || node?.id;
  if (!root) {
    return null;
  }

  // If there is a branch passed via URL parameter, we need to overwrite
  // the selected branch in the view otherwise we display a wrong branch

  return (
    <TemporaryViewProvider>
      <ViewContextProvider root={root}>{children}</ViewContextProvider>
    </TemporaryViewProvider>
  );
}
