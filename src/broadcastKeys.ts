import { useEffect, useRef, useState } from "react";
import { Map } from "immutable";
import { Event, Filter, UnsignedEvent, getPublicKey, nip04 } from "nostr-tools";
import { KEY_DISTR_EVENT, sortEventsDescending } from "./nostr";
import { useEventQuery } from "./useNostrQuery";

export async function tryToDecryptBroadcastKey(
  event: Event,
  privateKey: string
): Promise<[PublicKey, Buffer | undefined]> {
  const publicKey = event.pubkey as PublicKey;
  try {
    const decryptedPayload = await nip04.decrypt(
      privateKey,
      publicKey,
      event.content
    );
    const { e: encryptionKey, i: issuer } = JSON.parse(
      Buffer.isBuffer(decryptedPayload)
        ? Buffer.from(decryptedPayload).toString()
        : decryptedPayload
    ) as { e: string | Buffer; i: string };
    return [issuer as PublicKey, Buffer.from(encryptionKey)];
  } catch {
    return [publicKey, undefined];
  }
}

function createBroadcastKeysQuery(
  myNostrPublicKey: PublicKey,
  authors: string[]
): Filter<number> {
  return {
    kinds: [KEY_DISTR_EVENT],
    authors,
    "#p": [myNostrPublicKey],
  };
}

export function useBroadcastKeysQuery(
  user: KeyPair,
  authors: string[],
  enabled: boolean,
  readFromRelays: Relays
): [BroadcastKeys | undefined, boolean] {
  // TODO: upgrade to react-18 and remove this stuff
  const componentIsMounted = useRef(true);
  useEffect(() => {
    return () => {
      // eslint-disable-next-line functional/immutable-data
      componentIsMounted.current = false;
    };
  }, []);

  const myNostrPublicKey = getPublicKey(user.privateKey) as PublicKey;
  const { events, eose } = useEventQuery(
    [createBroadcastKeysQuery(myNostrPublicKey, authors)],
    {
      enabled,
      readFromRelays,
    }
  );
  const [broadcastKeys, setBroadcastKeys] = useState<BroadcastKeys | undefined>(
    undefined
  );

  useEffect(() => {
    if (!eose) {
      return;
    }
    (async () => {
      const keys = Map<PublicKey, Buffer | undefined>(
        await Promise.all(
          sortEventsDescending(events.valueSeq().toList())
            .toArray()
            .map((event) => tryToDecryptBroadcastKey(event, user.privateKey))
        )
      ).filter((key) => key !== undefined) as Map<PublicKey, Buffer>;
      if (componentIsMounted.current) {
        setBroadcastKeys((existing) =>
          existing ? existing.merge(keys) : keys
        );
      }
    })();
  }, [JSON.stringify(events.keySeq().sort()), eose]);

  return [broadcastKeys, !!broadcastKeys];
}

export async function createSendBroadcastKeyEvent({
  from,
  to,
  broadcastKey,
  issuer,
}: {
  from: string;
  to: PublicKey;
  broadcastKey: Buffer;
  issuer?: string;
}): Promise<UnsignedEvent<5805>> {
  const payload = JSON.stringify({
    i: issuer || getPublicKey(from),
    e: broadcastKey,
  });
  return {
    kind: KEY_DISTR_EVENT,
    pubkey: getPublicKey(from),
    created_at: Math.floor(Date.now() / 1000),
    tags: [["p", to]],
    content: await nip04.encrypt(from, to, payload),
  };
}
