import React from "react";
import { SimplePool } from "nostr-tools";
import { usePool } from "./NostrProvider";

export type Apis = {
  fileStore: LocalStorage;
  relayPool: SimplePool;
};

const ApiContext = React.createContext<Apis | undefined>(undefined);

export function useApis(): Apis {
  const context = React.useContext(ApiContext);
  if (context === undefined) {
    throw new Error("ApiContext not provided");
  }
  return context;
}

export function ApiProvider({
  children,
  apis,
}: {
  children: React.ReactNode;
  apis: Omit<Apis, "relayPool"> & { relayPool?: SimplePool };
}): JSX.Element {
  return (
    <ApiContext.Provider
      value={{
        relayPool: apis.relayPool || usePool(),
        fileStore: apis.fileStore,
      }}
    >
      {children}
    </ApiContext.Provider>
  );
}
