import React, { useState } from "react";
import { getPublicKey } from "nostr-tools";
import { hexToBytes } from "@noble/hashes/utils";
import { useApis } from "./Apis";

type Context = {
  user: KeyPair | undefined;
  setBlockstackUser: (user: KeyPair | undefined) => void;
};

export const NostrAuthContext = React.createContext<Context | undefined>(
  undefined
);

function getPublicKeyFromContext(context: Context): PublicKey | undefined {
  if (!context.user) {
    return undefined;
  }
  return context.user.publicKey;
}

export function useUser(): KeyPair | undefined {
  const context = React.useContext(NostrAuthContext);
  if (!context) {
    throw new Error("NostrAuthContext missing");
  }
  return context.user;
}

function userFromPrivateKey(privateKey: string): KeyPair {
  const key = hexToBytes(privateKey);
  const publicKey = getPublicKey(key) as PublicKey;
  return {
    publicKey,
    privateKey: key,
  };
}

export function useLogin(): (privateKey: string) => void {
  const context = React.useContext(NostrAuthContext);
  const { fileStore } = useApis();
  const { setLocalStorage } = fileStore;
  if (!context) {
    throw new Error("NostrAuthContext missing");
  }
  return (privateKey) => {
    setLocalStorage("privateKey", privateKey);
    context.setBlockstackUser(userFromPrivateKey(privateKey));
  };
}

export function useLogout(): () => void {
  const context = React.useContext(NostrAuthContext);
  const { fileStore } = useApis();
  const { deleteLocalStorage } = fileStore;
  if (!context) {
    throw new Error("NostrAuthContext missing");
  }

  return () => {
    context.setBlockstackUser(undefined);
    const publicKey = getPublicKeyFromContext(context);
    if (publicKey) {
      deleteLocalStorage(publicKey);
    }
    deleteLocalStorage("privateKey");
  };
}

export function NostrAuthContextProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const { fileStore } = useApis();
  const keyFromStorage = fileStore.getLocalStorage("privateKey");
  const [user, setUser] = useState<KeyPair | undefined>(
    keyFromStorage !== null ? userFromPrivateKey(keyFromStorage) : undefined
  );

  return (
    <NostrAuthContext.Provider
      value={{
        setBlockstackUser: setUser,
        user,
      }}
    >
      {children}
    </NostrAuthContext.Provider>
  );
}
