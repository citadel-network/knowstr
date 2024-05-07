import { Filter } from "nostr-tools";
import React from "react";
import { useNode, useNodeID } from "./ViewContext";
import { shortID } from "./connections";

const QueryContext = React.createContext<
  { filters: Filter[]; allEventsProcessed: boolean } | undefined
>(undefined);

export function RegisterQuery({
  children,
  filters,
  allEventsProcessed,
}: {
  children: React.ReactNode;
  filters: Filter[];
  allEventsProcessed: boolean;
}): JSX.Element {
  return (
    <QueryContext.Provider value={{ filters, allEventsProcessed }}>
      {children}
    </QueryContext.Provider>
  );
}

export function useNodeIsLoading(): boolean {
  const [node] = useNode();
  const [nodeID] = useNodeID();
  const context = React.useContext(QueryContext);

  if (node || !context || context.allEventsProcessed) {
    return false;
  }
  const id = shortID(nodeID);
  return (
    context.filters.find((filter) => {
      return (filter["#d"] || []).includes(id);
    }) !== undefined
  );
}
