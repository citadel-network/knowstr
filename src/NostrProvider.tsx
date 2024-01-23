import React, { useEffect, useState } from "react";
// eslint-disable-next-line import/no-unresolved
import { setNostrWasm } from "nostr-tools/wasm";
import { initNostrWasm } from "nostr-wasm";
import { AbstractSimplePool, verifyEvent } from "nostr-tools";

const Context = React.createContext<AbstractSimplePool | undefined>(undefined);

export function usePool(): AbstractSimplePool {
  const context = React.useContext(Context);
  if (context === undefined) {
    throw new Error("NostrProvider not found");
  }
  return context;
}

export function NostrProvider({
  children,
}: {
  children: React.ReactNode;
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
  return <Context.Provider value={pool}>{children}</Context.Provider>;
}
