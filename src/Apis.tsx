import React from "react";
import { Map } from "immutable";
import { EventTemplate, SimplePool, VerifiedEvent, Event } from "nostr-tools";
// eslint-disable-next-line import/no-unresolved
import { RelayInformation } from "nostr-tools/lib/types/nip11";

export type FinalizeEvent = (
  t: EventTemplate,
  secretKey: Uint8Array
) => VerifiedEvent;

export type Apis = {
  fileStore: LocalStorage;
  relayPool: SimplePool;
  finalizeEvent: FinalizeEvent;
  nip11: {
    fetchRelayInformation: (url: string) => Promise<RelayInformation>;
    searchDebounce: number;
  };
  nip05Query: {
    query: (
      author: PublicKey,
      relays: Array<Relay>
    ) => {
      events: Map<string, Event>;
      eose: boolean;
    };
    timeout: number;
  };
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
  return <ApiContext.Provider value={apis}>{children}</ApiContext.Provider>;
}
