import React from "react";
import { useParams } from "react-router-dom";
import { RootViewContextProvider, useNode } from "../ViewContext";
import { TemporaryViewProvider } from "./TemporaryViewContext";

export function useNodeIDFromURL(): LongID | undefined {
  const params = useParams<{
    openNodeID?: LongID;
  }>();
  return params.openNodeID;
}

export function FullScreenViewWrapper({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element | null {
  // The ID is part of this route, so it will always be defined
  const id = useNodeIDFromURL();
  const [node] = useNode();
  const root = id || node?.id;
  if (!root) {
    return null;
  }

  return (
    <TemporaryViewProvider>
      <RootViewContextProvider root={root}>{children}</RootViewContextProvider>
    </TemporaryViewProvider>
  );
}
