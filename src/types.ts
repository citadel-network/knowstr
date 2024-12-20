import { Map, OrderedMap, List } from "immutable";
import { Event, EventTemplate, UnsignedEvent } from "nostr-tools";
// eslint-disable-next-line import/no-unresolved
import { RelayInformation } from "nostr-tools/lib/types/nip11";

declare global {
  type Children = {
    children?: React.ReactNode;
  };

  type PublicKey = string & { readonly "": unique symbol };

  type Relay = {
    url: string;
    read: boolean;
    write: boolean;
  };

  type SuggestedRelay = Relay & {
    numberOfContacts: number;
  };

  type Relays = Array<Relay>;

  type SuggestedRelays = Array<SuggestedRelay>;

  type NotificationMessage = {
    title: string;
    message: string;
    date?: Date;
    navigateToLink?: string;
  };

  type PublishStatus = {
    status: "rejected" | "fulfilled";
    reason?: string;
  };
  type PublishResultsOfEvent = {
    event: Event;
    results: Map<string, PublishStatus>;
  };
  type PublishResultsEventMap = Map<string, PublishResultsOfEvent>;

  type PublishEvents<T = void> = {
    unsignedEvents: List<UnsignedEvent & T>;
    results: PublishResultsEventMap;
    isLoading: boolean;
  };

  type PublishResultsOfRelay = Map<string, Event & PublishStatus>;
  type PublishResultsRelayMap = Map<string, PublishResultsOfRelay>;
  type RepublishEvents = (
    events: List<Event>,
    relayUrl: string
  ) => Promise<void>;

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

  export type Member = Contact & {
    votes: number;
  };

  export type HasPublicKey = {
    publicKey: PublicKey;
  };

  type Contacts = Map<PublicKey, Contact>;
  type Members = Map<PublicKey, Member>;

  type KnowledgeDBs = Map<PublicKey, KnowledgeData>;

  type LocationState = {
    referrer?: string;
  };

  type WriteRelayConf = {
    defaultRelays?: boolean;
    user?: boolean;
    project?: boolean;
    contacts?: boolean;
    extraRelays?: Relays;
  };

  type EventAttachment = {
    writeRelayConf?: WriteRelayConf;
  };

  type EventState = PublishEvents<EventAttachment> & {
    preLoginEvents: List<UnsignedEvent & EventAttachment>;
  };

  type AllRelays = {
    defaultRelays: Relays;
    userRelays: Relays;
    projectRelays: Relays;
    contactsRelays: Relays;
  };

  type Data = {
    contacts: Contacts;
    user: User;
    settings: Settings;
    contactsRelays: Map<PublicKey, Relays>;
    knowledgeDBs: KnowledgeDBs;
    relaysInfos: Map<string, RelayInformation | undefined>;
    publishEventsStatus: EventState;
    projectMembers: Members;

    views: Views;
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

  type TextNode = BasicNode & {
    imageUrl?: string;
  };

  // Other Fields which we don't use
  // - contract
  // - geo
  type ProjectNode = BasicNode & {
    tokenSupply?: number;
    address?: string;
    imageUrl?: string;
    // Ideally this should be changeable through a running election
    relays: Relays;
    perpetualVotes?: LongID;
    quarterlyVotes?: LongID;
    dashboardInternal?: LongID;
    dashboardPublic?: LongID;
    website?: LongID;
    app?: LongID;
    createdAt: Date;
    memberListProvider: PublicKey;
  };

  type Workspace = {
    id: LongID;
    node: LongID;
    project: LongID | undefined;
  };
  type Workspaces = Map<ID, Workspace>;

  type BookmarkedProjects = List<LongID>;

  type KnowNode = TextNode | ProjectNode;

  type Views = Map<string, View>;

  type Nodes = Map<ID, KnowNode>;

  type RelationType = {
    color: string;
    label: string;
    invertedRelationLabel: string;
  };
  type RelationTypes = OrderedMap<ID, RelationType>;

  type KnowledgeData = {
    nodes: Map<ID, KnowNode>;
    relations: Map<ID, Relations>;
  };
}
