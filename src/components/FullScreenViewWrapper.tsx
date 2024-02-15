import React from "react";
import { useParams } from "react-router-dom";
import { RootViewContextProvider, useNode } from "../ViewContext";
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
  const root = (id as LongID) || node?.id;
  if (!root) {
    return null;
  }

  return (
    <TemporaryViewProvider>
      <RootViewContextProvider root={root}>{children}</RootViewContextProvider>
    </TemporaryViewProvider>
  );
}
