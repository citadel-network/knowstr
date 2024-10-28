export const KIND_RELAY_METADATA_EVENT = 10002;

export const DEFAULT_RELAYS: Relays = [
  { url: "wss://relay.damus.io/", read: true, write: true },
  { url: "wss://nos.lol/", read: true, write: true },
  { url: "wss://relay.nostr.band/", read: true, write: true },
  { url: "wss://nostr.cercatrova.me/", read: true, write: true },
  { url: "wss://nostr.mom/", read: true, write: true },
  { url: "wss://nostr.noones.com/", read: true, write: true },
];

// eslint-disable-next-line functional/no-let
let lastPublished = 0;

export function newTimestamp(): number {
  const ts = Math.floor(Date.now() / 1000);
  const timestamp = ts > lastPublished ? ts : lastPublished + 1;
  lastPublished = timestamp;
  return timestamp;
}
