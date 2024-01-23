import React, { useEffect, useState } from "react";
// eslint-disable-next-line import/no-unresolved
import { setNostrWasm } from "nostr-tools/wasm";
import { initNostrWasm } from "nostr-wasm";
import { AbstractSimplePool, verifyEvent } from "nostr-tools";
import { ApiProvider, Apis } from "./Apis";

export function NostrProvider({
  children,
  apis,
}: {
  children: React.ReactNode;
  apis: Omit<Apis, "relayPool">;
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
      }}
    >
      {children}
    </ApiProvider>
  );
}
