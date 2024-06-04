import React, { useState } from "react";
import { getPublicKey } from "nostr-tools";
import { hexToBytes } from "@noble/hashes/utils";
import { DEFAULT_RELAYS, sanitizeRelays } from "citadel-commons";
import { useApis } from "./Apis";

type Context = {
  user: User | undefined;
  setBlockstackUser: (user: User | undefined) => void;
  defaultRelays: Relays;
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

export function isUserLoggedIn(user: User): user is KeyPair {
  return (user as KeyPair).privateKey !== undefined;
}

export function useUser(): User | undefined {
  const context = React.useContext(NostrAuthContext);
  if (!context) {
    throw new Error("NostrAuthContext missing");
  }
  return context.user;
}

export function useDefaultRelays(): Relays {
  const context = React.useContext(NostrAuthContext);
  if (!context) {
    throw new Error("NostrAuthContext missing");
  }
  return context.defaultRelays;
}

function userFromPrivateKey(privateKey: string): User {
  const key = hexToBytes(privateKey);
  const publicKey = getPublicKey(key) as PublicKey;
  return {
    publicKey,
    privateKey: key,
  };
}

export function useLogin(): (privateKey: string) => User {
  const context = React.useContext(NostrAuthContext);
  const { fileStore } = useApis();
  const { setLocalStorage } = fileStore;
  if (!context) {
    throw new Error("NostrAuthContext missing");
  }
  return (privateKey) => {
    setLocalStorage("privateKey", privateKey);
    const user = userFromPrivateKey(privateKey);
    context.setBlockstackUser(user);
    return user;
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
    window.location.reload();
  };
}

export function NostrAuthContextProvider({
  defaultRelayUrls,
  children,
}: {
  defaultRelayUrls?: Array<string>;
  children: React.ReactNode;
}): JSX.Element {
  const { fileStore } = useApis();
  const keyFromStorage = fileStore.getLocalStorage("privateKey");
  const [user, setUser] = useState<User | undefined>(
    keyFromStorage !== null ? userFromPrivateKey(keyFromStorage) : undefined
  );
  const relays = defaultRelayUrls
    ? sanitizeRelays(
        defaultRelayUrls?.map((url) => {
          return { url, read: true, write: true };
        })
      )
    : DEFAULT_RELAYS;

  return (
    <NostrAuthContext.Provider
      value={{
        setBlockstackUser: setUser,
        user,
        defaultRelays: relays,
      }}
    >
      {children}
    </NostrAuthContext.Provider>
  );
}
