import React, { useEffect, useState } from "react";
// eslint-disable-next-line import/no-unresolved
import { setNostrWasm } from "nostr-tools/wasm";
import {
  nip11,
  AbstractSimplePool,
  verifyEvent,
  finalizeEvent,
} from "nostr-tools";
import { initNostrWasm } from "nostr-wasm";
import { ApiProvider, Apis } from "./Apis";
import { useNip05Query } from "./components/useNip05Query";

export function NostrProvider({
  children,
  apis,
}: {
  children: React.ReactNode;
  apis: Omit<Apis, "relayPool" | "finalizeEvent" | "nip11" | "nip05Query">;
}): JSX.Element {
  const [pool, setPool] = useState<AbstractSimplePool | undefined>(undefined);

  useEffect(() => {
    (async () => {
      setNostrWasm(await initNostrWasm());
      setPool(new AbstractSimplePool({ verifyEvent }));
    })();
  }, []);
  if (!pool) {
    return <div className="loading" aria-label="loading" />;
  }
  return (
    <ApiProvider
      apis={{
        ...apis,
        relayPool: pool,
        finalizeEvent,
        nip11: {
          ...nip11,
          searchDebounce: 500,
        },
        nip05Query: {
          query: (author: PublicKey, relays: Relays) =>
            useNip05Query(pool, author, relays),
          timeout: 500,
        },
      }}
    >
      {children}
    </ApiProvider>
  );
}
