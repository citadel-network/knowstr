import { Map, OrderedMap, Set, List } from "immutable";
import { Event } from "nostr-tools";
import { Serializable } from "./serializer";

declare global {
  export type KeyPair = {
    privateKey: string;
    publicKey: PublicKey;
  };

  export type Contact = {
    publicKey: PublicKey;
    createdAt?: Date;
  };

  export type ContactOfContact = Contact & {
    commonContact: PublicKey;
  };

  export type HasPublicKey = {
    publicKey: PublicKey;
  };

  /* eslint-disable camelcase */
  type RawContactEntry = {
    user: string;
    payload: string;
    public_key: string;
  };
  /* eslint-enable camelcase */

  type Contacts = Map<PublicKey, Contact>;
  type ContactsOfContacts = Map<PublicKey, ContactOfContact>;

  type BroadcastKeys = Map<PublicKey, Buffer>;

  type Relay = {
    url: string;
    read: boolean;
    write: boolean;
  };

  type Relays = Array<Relay>;

  type Data = {
    contacts: Contacts;
    contactsOfContacts: ContactsOfContacts;
    user: KeyPair;
    broadcastKeys: BroadcastKeys;
    sentEvents: List<Event>;
    settings: Settings;
    relays: Relays;
  };

  type SymmetricEncryptedText = {
    iv: Buffer;
    cipherText: string;
  };

  type EncryptSymmetric = (
    payload: Serializable,
    encryptionKey: Buffer
  ) => SymmetricEncryptedText;

  type DecryptSymmetric = (
    iv: string,
    cipherText: string,
    key: string
  ) => Serializable;

  type Encryption = {
    encryptSymmetric: EncryptSymmetric;
    decryptSymmetric: DecryptSymmetric;
  };

  type LocalStorage = {
    setLocalStorage: (key: string, value: string) => void;
    getLocalStorage: (key: string) => string | null;
    deleteLocalStorage: (key: string) => void;
  };

  type Blobs = Map<string, string>;

  type NotificationMessage = {
    title: string;
    message: string;
    date?: Date;
    navigateToLink?: string;
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

  type PublicKey = string & { readonly "": unique symbol };

  type NodeType = "NOTE" | "TOPIC" | "URL" | "TITLE" | "QUOTE" | "WORKSPACE";

  type RelationType = "RELEVANCE" | "CONTAINS" | "SUMMARY";

  type Repos = Map<string, Repo>;
  type SortedRepos = OrderedMap<string, Repo>;

  type Hash = string;
  type ID = string;

  type View = {
    displaySubjects: boolean;
    relationType: RelationType;
    width: number;
    branch: BranchPath;
    // Show children, only relevant for inner nodes
    expanded?: boolean;
  };

  type Relation = {
    id: string;
  };

  type Relations = List<Relation>;

  type KnowNode = {
    text: string;
    nodeType: NodeType;
    relations: Map<RelationType, Relations>;
  };

  type Commit = {
    hash: Hash;
    date: Date;
    parents: Set<ID>;
  };

  type BranchPath = [PublicKey | undefined, string];

  type BasicBranch = {
    origin?: BranchPath;
  };

  type BranchWithStaged = BasicBranch & {
    staged: KnowNode;
    head?: Hash;
  };

  type BranchWithCommits = BasicBranch & {
    head: Hash;
    staged?: KnowNode;
  };

  type Branch = BranchWithCommits | BranchWithStaged;

  type Repo<T extends BranchWithCommits | BranchWithStaged = Branch> = {
    id: ID;
    commits: Map<Hash, Commit>;
    objects: Map<Hash, KnowNode>;
    branches: Map<string, T>;
    remotes: Map<PublicKey, Map<string, BranchWithCommits>>;
  };

  type RepoWithCommits = Repo<BranchWithCommits>;

  type RemoteRepo = Omit<RepoWithCommits, "remotes">;

  type Views = Map<string, View>;

  type KnowledgeData<T extends BranchWithCommits | BranchWithStaged = Branch> =
    {
      repos: Map<string, Repo<T>>;
      activeWorkspace: string;
      views: Views;
    };
  type KnowledgeDataWithCommits = KnowledgeData<BranchWithCommits>;
}
