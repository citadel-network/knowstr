import { Map, OrderedMap, List } from "immutable";
import { Event, EventTemplate, UnsignedEvent } from "nostr-tools";
// eslint-disable-next-line import/no-unresolved
import { RelayInformation } from "nostr-tools/lib/types/nip11";

declare global {
  export type Nostr = {
    getPublicKey: () => Promise<PublicKey>;
    signEvent: (event: EventTemplate) => Promise<Event>;
  };

  interface Window {
    nostr: Nostr;
  }

  export type KeyPair = {
    privateKey: Uint8Array;
    publicKey: PublicKey;
  };

  export type User =
    | KeyPair
    | {
        publicKey: PublicKey;
      };

  export type Contact = {
    publicKey: PublicKey;
    mainRelay?: string;
    userName?: string;
  };

  export type ContactOfContact = Contact & {
    commonContact: PublicKey;
  };

  export type HasPublicKey = {
    publicKey: PublicKey;
  };

  type Contacts = Map<PublicKey, Contact>;

  type KnowledgeDBs = Map<PublicKey, KnowledgeData>;

  type EventState = PublishEvents & {
    preLoginEvents: List<UnsignedEvent>;
  };

  type Data = {
    contacts: Contacts;
    user: User;
    settings: Settings;
    relays: Relays;
    contactsRelays: Map<PublicKey, Relays>;
    knowledgeDBs: KnowledgeDBs;
    relaysInfos: Map<string, RelayInformation | undefined>;
    publishEventsStatus: EventState;

    views: Views;
    workspaces: List<ID>;
    activeWorkspace: LongID;
    contactsWorkspaces: Map<PublicKey, List<ID>>;
  };

  type LocalStorage = {
    setLocalStorage: (key: string, value: string) => void;
    getLocalStorage: (key: string) => string | null;
    deleteLocalStorage: (key: string) => void;
  };

  type Settings = {
    bionicReading: boolean;
  };

  type CompressedSettings = {
    b: boolean; // bionicReading
    v: string;
    n: Buffer;
  };

  type CompressedSettingsFromStore = {
    b: boolean;
    v: string;
    n: string;
  };

  type Hash = string;
  type ID = string;
  type LongID = string & { readonly "": unique symbol };

  type View = {
    virtualLists?: Array<LongID>;
    relations?: LongID;
    width: number;
    // Show children, only relevant for inner nodes
    expanded?: boolean;
  };

  type Relations = {
    items: List<LongID | ID>;
    head: ID;
    id: LongID;
    type: ID;
    updated: number;
    author: PublicKey;
  };

  type BasicNode = {
    id: LongID;
    text: string;
    type: "text" | "project";
  };

  type TextNode = BasicNode;

  // Other Fields which we don't use
  // - contract
  // - geo
  type ProjectNode = BasicNode & {
    tokenSupply?: number;
    address?: string;
    image?: string;
    // Ideally this should be changeable through a running election
    relays: Relays;
    perpetualVotes?: LongID;
    quarterlyVotes?: LongID;
    dashboardInternal?: LongID;
    dashboardPublic?: LongID;
    createdAt: Date;
  };

  type KnowNode = TextNode | ProjectNode;

  type Views = Map<string, View>;

  type Nodes = Map<ID, KnowNode>;

  type RelationType = { color: string; label: string };
  type RelationTypes = OrderedMap<ID, RelationType>;

  type KnowledgeData = {
    nodes: Map<ID, KnowNode>;
    relations: Map<ID, Relations>;
  };
}
