export const KIND_SETTINGS = 11071;

export const KIND_VIEWS = 11074;
export const KIND_WORKSPACES = 11075;
export const KIND_RELATION_TYPES = 11076;

export const KIND_KNOWLEDGE_LIST = 34750;
export const KIND_KNOWLEDGE_NODE = 34751;
// Essentially a markdown which is not editable
export const KIND_KNOWLEDGE_NODE_COLLECTION = 2945;

export const KIND_NIP05 = 0;
export const KIND_CONTACTLIST = 3;
export const KIND_DELETE = 5;

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
