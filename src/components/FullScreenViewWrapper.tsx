import React from "react";
import { useParams } from "react-router-dom";
import { RootViewContextProvider } from "../ViewContext";
import { TemporaryViewProvider } from "./TemporaryViewContext";
import { LoadNode } from "../dataQuery";

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
  const root = id;
  if (!root) {
    return null;
  }

  return (
    <TemporaryViewProvider>
      <RootViewContextProvider root={root}>
        <LoadNode>{children}</LoadNode>
      </RootViewContextProvider>
    </TemporaryViewProvider>
  );
}
