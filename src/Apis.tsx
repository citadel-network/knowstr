import React from "react";
import { SimplePool } from "nostr-tools";

export type Apis = {
  encryption: Encryption;
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
  apis: Apis;
}): JSX.Element {
  return (
    <ApiContext.Provider
      value={{
        ...apis,
      }}
    >
      {children}
    </ApiContext.Provider>
  );
}
