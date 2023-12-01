import React from "react";
import { List, Map } from "immutable";
import {
  render,
  fireEvent,
  screen,
  waitFor,
  MatcherFunction,
} from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { v4 } from "uuid";
import { Event, getPublicKey, matchFilter } from "nostr-tools";
import { DEFAULT_RELAYS, KEY_DISTR_EVENT } from "./nostr";
import { RequireLogin } from "./AppState";
import {
  createContactsOfContactsQuery,
  createContactsQuery,
  decryptContactOfContactsEvents,
  parseContactEvent,
} from "./contacts";
import { ConfigurationContextProvider } from "./ConfigurationContext";
import {
  planSetKnowledgeData,
  createPlan,
  planEnsurePrivateContact,
} from "./planner";
import { execute } from "./executor";
import { ApiProvider, Apis } from "./Apis";
import { App } from "./App";
import { DataContextProps } from "./DataContext";
import { commitAllBranches, newDB, newRepo } from "./knowledge";
import { newNode } from "./connections";
import { MockRelayPool, mockRelayPool } from "./nostrMock.test";
import { tryToDecryptBroadcastKey } from "./broadcastKeys";
import { DEFAULT_SETTINGS } from "./settings";
import {
  KnowledgeDiff,
  compareKnowledgeDB,
  createKnowledgeQuery,
  createKnowledgeDBs,
  decryptKnowledgeEvents,
  KnowledgeDiffWithCommits,
  mergeKnowledgeData,
} from "./knowledgeEvents";
import { createEncryption } from "./encryption";
import { NostrAuthContext } from "./NostrAuthContext";

// eslint-disable-next-line @typescript-eslint/no-empty-function
test.skip("skip", () => {});

export const BOB_PRIVATE_KEY =
  "00000f1cf58c28647c7b7dc198dcbc4de860948933e56001ab9fc17e1b8d072e";

export const BOB_PUBLIC_KEY =
  "71a20276981b2a5019f634adfe10accd7e188f3eb5f57079da52de40b742a923" as PublicKey;

export const CAROL_PRIVATE_KEY =
  "10000f1cf58c28647c7b7dc198dcbc4de860948933e56001ab9fc17e1b8d072e";
export const CAROL_PUBLIC_KEY =
  "074eb94a7a3d34102b563b540ac505e4fa8f71e3091f1e39a77d32e813c707d2" as PublicKey;

const UNAUTHENTICATED_ALICE: Contact = {
  publicKey:
    "f0289b28573a7c9bb169f43102b26259b7a4b758aca66ea3ac8cd0fe516a3758" as PublicKey,
};

const ALICE: KeyPair = {
  publicKey: UNAUTHENTICATED_ALICE.publicKey,
  privateKey:
    "04d22f1cf58c28647c7b7dc198dcbc4de860948933e56001ab9fc17e1b8d072e",
};

const ALICE_BROADCAST_KEY = Buffer.from("aliceBroadcastKey");

const UNAUTHENTICATED_BOB: Contact = {
  publicKey: BOB_PUBLIC_KEY,
};

export const BOB: KeyPair = {
  publicKey: BOB_PUBLIC_KEY,
  privateKey: BOB_PRIVATE_KEY,
};

const UNAUTHENTICATED_CAROL: Contact = {
  publicKey: CAROL_PUBLIC_KEY,
};

export const CAROL: KeyPair = {
  publicKey: CAROL_PUBLIC_KEY,
  privateKey: CAROL_PRIVATE_KEY,
};

export const TEST_WORKSPACE_ID = "my-first-workspace-id";

const DEFAULT_TEST_BOOTSTRAP_INTERVAL = 3;

type MockFileStore = LocalStorage & {
  getLocalStorageData: () => Map<string, string>;
};

function mockFileStore(): MockFileStore {
  const localStorage = jest.fn().mockReturnValue(Map());
  return {
    setLocalStorage: (key: string, value: string) => {
      const updatedLocalStorage = localStorage().set(key, value);
      localStorage.mockReturnValue(updatedLocalStorage);
    },
    getLocalStorage: (key: string): string | null => {
      return localStorage().get(key, null);
    },
    deleteLocalStorage: (key: string) => {
      const updatedLocalStorage = localStorage().delete(key);
      localStorage.mockReturnValue(updatedLocalStorage);
    },
    getLocalStorageData: (): Map<string, string> => localStorage(),
  };
}

type TestApis = Omit<Apis, "fileStore" | "relayPool"> & {
  fileStore: MockFileStore;
  relayPool: MockRelayPool;
};

function applyApis(props?: Partial<TestApis>): TestApis {
  return {
    encryption: createEncryption(),
    fileStore: mockFileStore(),
    relayPool: mockRelayPool(),
    ...props,
  };
}

type RenderApis = Partial<TestApis> & {
  initialRoute?: string;
  testBootstrapInterval?: number;
  user?: KeyPair;
};

function renderApis(
  children: React.ReactElement,
  options?: RenderApis
): TestApis {
  const { encryption, fileStore, relayPool } = applyApis(options);
  // If user is explicity undefined it will be overwritten, if not set default Alice is used
  const optionsWithDefaultUser = {
    user: ALICE,
    ...options,
  };
  const user = optionsWithDefaultUser.user
    ? {
        privateKey: optionsWithDefaultUser.user.privateKey,
        publicKey: optionsWithDefaultUser.user.publicKey,
      }
    : undefined;
  window.history.pushState({}, "", options?.initialRoute || "/");
  render(
    <BrowserRouter>
      <ConfigurationContextProvider
        bootstrapInterval={
          options?.testBootstrapInterval || DEFAULT_TEST_BOOTSTRAP_INTERVAL
        }
      >
        <ApiProvider
          apis={{
            encryption,
            fileStore,
            relayPool,
          }}
        >
          <NostrAuthContext.Provider
            value={{
              user,
              setBlockstackUser: jest.fn(),
            }}
          >
            {children}
          </NostrAuthContext.Provider>
        </ApiProvider>
      </ConfigurationContextProvider>
    </BrowserRouter>
  );
  return {
    encryption,
    fileStore,
    relayPool,
  };
}

type RenderViewResult = TestApis;

function renderApp(props: RenderApis): RenderViewResult {
  const testApis = applyApis(props);
  return renderApis(<App />, {
    ...testApis,
    testBootstrapInterval: props.testBootstrapInterval,
  });
}

export function waitForLoadingToBeNull(): Promise<void> {
  return waitFor(
    () => {
      expect(screen.queryByLabelText("loading")).toBeNull();
    },
    {
      // it tests which use real encryption can be slow
      timeout: 10000,
    }
  );
}

const DEFAULT_DATA_CONTEXT_PROPS: DataContextProps = {
  user: ALICE,
  contacts: Map<PublicKey, Contact>(),
  contactsOfContacts: Map<PublicKey, ContactOfContact>(),
  broadcastKeys: Map<PublicKey, Buffer>(),
  sentEvents: List<Event>(),
  settings: DEFAULT_SETTINGS,
  relays: DEFAULT_RELAYS,
};

export const EMPTY_PLAN = {
  ...DEFAULT_DATA_CONTEXT_PROPS,
  encryption: createEncryption(),
  setData: false,
  publishEvents: List<Event>(),
  user: ALICE,
  broadcastKey: ALICE_BROADCAST_KEY,
  relays: [],
};

type TestAppState = DataContextProps & TestApis;

function applyDefaults(props?: Partial<TestAppState>): TestAppState {
  return {
    ...applyApis(props),
    ...DEFAULT_DATA_CONTEXT_PROPS,
    ...props,
  };
}

export async function extractBroadcastKey(
  events: Array<Event>,
  from: PublicKey,
  to: string
): Promise<Buffer> {
  const filter = {
    tags: ["#p", getPublicKey(to)],
    authors: [from],
    kinds: [KEY_DISTR_EVENT],
  };
  const event = events.filter((e) => matchFilter(filter, e))[0];
  if (!event) {
    throw new Error("Key distribution event not found");
  }
  const decrypted = await tryToDecryptBroadcastKey(event, to);
  return decrypted[1] as Buffer;
}

async function extractAllBroadcastKeys(
  appState: TestAppState
): Promise<BroadcastKeys> {
  const events = appState.relayPool.getEvents();
  const filter = {
    kinds: [KEY_DISTR_EVENT],
    "#p": [getPublicKey(appState.user.privateKey)],
  };
  const keyEvents = events.filter((e) => matchFilter(filter, e));
  const keys = (
    await Promise.all(
      keyEvents.map(
        async (event): Promise<[PublicKey, Buffer | undefined]> =>
          tryToDecryptBroadcastKey(event, appState.user.privateKey)
      )
    )
  ).filter((key) => key !== undefined) as Array<[PublicKey, Buffer]>;
  return Map<PublicKey, Buffer>(keys);
}

export async function extractKnowledgeEvents(
  appState: TestAppState
): Promise<Map<string, Event>> {
  const broadcastKeys = await extractAllBroadcastKeys(appState);
  const query = createKnowledgeQuery(broadcastKeys.keySeq().toArray());
  return Map<string, Event>(
    List<Event>(appState.relayPool.getEvents())
      .filter((e) => matchFilter(query, e))
      .map((e) => [e.id, e])
  );
}

export async function extractKnowledgeDiffs(
  appState: TestAppState,
  events: Map<string, Event>
): Promise<Map<string, KnowledgeDiffWithCommits>> {
  return decryptKnowledgeEvents(
    events,
    Map<string, KnowledgeDiff<BranchWithCommits>>(),
    await extractAllBroadcastKeys(appState),
    appState.encryption.decryptSymmetric,
    appState.user.publicKey
  );
}

export async function extractKnowledgeDB(
  appState: TestAppState
): Promise<KnowledgeData> {
  const events = await extractKnowledgeEvents(appState);
  const decryptedDiffs = await extractKnowledgeDiffs(appState, events);
  return mergeKnowledgeData(
    createKnowledgeDBs(events, decryptedDiffs),
    appState.user.publicKey
  );
}

async function getPrivateContacts(appState: TestAppState): Promise<Contacts> {
  const query = createContactsQuery([appState.user.publicKey]);
  const events = List<Event>(appState.relayPool.getEvents()).filter((e) =>
    matchFilter(query, e)
  );
  const broadcastKeys = await extractAllBroadcastKeys(appState);
  const myBroadcastKey = broadcastKeys.get(appState.user.publicKey);
  const encryptedContactsEvent = events.last(undefined);
  if (!myBroadcastKey || !encryptedContactsEvent) {
    return Map<PublicKey, Contact>();
  }
  return parseContactEvent(
    encryptedContactsEvent,
    myBroadcastKey,
    appState.encryption.decryptSymmetric
  );
}

async function getContactsOfContacts(
  appState: TestAppState
): Promise<ContactsOfContacts> {
  const contacts = await getPrivateContacts(appState);
  const broadcastKeys = await extractAllBroadcastKeys(appState);
  const query = createContactsOfContactsQuery(contacts, broadcastKeys);
  const events = List<Event>(appState.relayPool.getEvents()).filter((e) =>
    matchFilter(query, e)
  );
  return decryptContactOfContactsEvents(
    events,
    contacts,
    broadcastKeys,
    appState.encryption.decryptSymmetric
  );
}

type UpdateState = () => Promise<TestAppState>;

export function setup(
  users: KeyPair[],
  options?: Partial<TestAppState>
): UpdateState[] {
  const appState = applyDefaults(options);
  return users.map((user): UpdateState => {
    return async (): Promise<TestAppState> => {
      const updatedState = {
        ...appState,
        user,
      };
      const contacts = appState.contacts.merge(
        await getPrivateContacts(updatedState)
      );
      // TODO: don't use all broadcast keys, but filter for contacts and contacts of contacts to make tests more realistic
      const broadcastKeys = await extractAllBroadcastKeys(updatedState);
      const contactsOfContacts = await getContactsOfContacts(updatedState);
      return {
        ...updatedState,
        contacts,
        broadcastKeys: updatedState.broadcastKeys.merge(broadcastKeys),
        contactsOfContacts,
      };
    };
  });
}

export async function addContact(
  cU: UpdateState,
  publicKey: PublicKey
): Promise<void> {
  const utils = await cU();
  const plan = await planEnsurePrivateContact(createPlan(utils), publicKey);
  await execute({
    ...utils,
    plan,
  });
  const filter = {
    kinds: [KEY_DISTR_EVENT],
    authors: [utils.user.publicKey],
    "#p": [publicKey],
  };
  await waitFor(() => {
    expect(
      utils.relayPool.getEvents().filter((e) => matchFilter(filter, e)).length
    ).toBeGreaterThanOrEqual(1);
  });
}

export async function connectContacts(
  a: UpdateState,
  b: UpdateState
): Promise<void> {
  const aUser = (await a()).user;
  const bUser = (await b()).user;
  await addContact(a, bUser.publicKey);
  await addContact(b, aUser.publicKey);
}

export function renderWithTestData(
  children: React.ReactElement,
  options?: Partial<TestAppState> & { initialRoute?: string }
): TestAppState {
  const props = applyDefaults(options);
  renderApis(
    <Routes>
      <Route element={<RequireLogin />}>
        <Route path="*" element={<>{children}</>} />
      </Route>
    </Routes>,
    props
  );
  return props;
}

export async function fillAndSubmitInviteForm(): Promise<void> {
  fireEvent.click(await screen.findByText("Share Now"));
  await waitForLoadingToBeNull();
}

function addTestWorkspaceToKnowledge(
  knowledgeData: KnowledgeData,
  title: string,
  testId?: string
): KnowledgeData {
  const id = testId || v4();
  const workspace = newRepo(newNode(`${title}`, "WORKSPACE"), id);
  return {
    ...knowledgeData,
    repos: knowledgeData.repos.set(id, workspace),
    activeWorkspace: id,
  };
}

export function createDefaultKnowledgeTestData(
  workspaceTestId?: string,
  title?: string
): KnowledgeData {
  return addTestWorkspaceToKnowledge(
    newDB(),
    title || "My Workspace",
    workspaceTestId
  );
}

export function commitAll(
  knowledgeData: KnowledgeData
): KnowledgeData<BranchWithCommits> {
  const commitedRepos = knowledgeData.repos.map((repo) => {
    return commitAllBranches(repo);
  });
  return {
    ...knowledgeData,
    repos: commitedRepos,
  };
}

export async function renderKnowledgeApp(
  knowledgeData: KnowledgeData<Branch>,
  appState?: UpdateState
): Promise<RenderViewResult> {
  const update = appState || setup([ALICE])[0];
  const utils = await update();
  const plan = createPlan(utils);
  const diff = compareKnowledgeDB<BranchWithCommits>(
    newDB(),
    commitAll(knowledgeData)
  );
  await execute({
    ...utils,
    plan: planSetKnowledgeData(plan, diff),
  });
  const view = renderApp(await update());
  await screen.findByText("My Workspace");
  return view;
}

export function expectTextContent(
  element: HTMLElement,
  textContent: Array<string>
): void {
  expect(element.textContent).toEqual(textContent.join(""));
}

function isElementMatchingSearchText(
  text: string,
  element: Element | null
): boolean {
  if (
    element === null ||
    element === undefined ||
    element.textContent === null ||
    element.textContent === ""
  ) {
    return false;
  }
  const searchTextParts = text.split(" ");
  return searchTextParts.every((part: string) =>
    element.textContent?.includes(part)
  );
}

function isNoChildDivElements(element: Element | null): boolean {
  if (element === null) {
    return true;
  }
  return Array.from(element.children).every((child) => child.tagName !== "DIV");
}

export function matchSplitText(text: string): MatcherFunction {
  const customTextMatcher = (
    content: string,
    element: Element | null
  ): boolean => {
    if (
      isElementMatchingSearchText(text, element) &&
      isNoChildDivElements(element)
    ) {
      // eslint-disable-next-line testing-library/no-node-access
      const childElements = element ? Array.from(element.children) : [];
      const foundChildElements = childElements.filter((child) =>
        isElementMatchingSearchText(text, child)
      );
      return foundChildElements.length === 0;
    }
    return false;
  };
  return customTextMatcher;
}

export { ALICE, UNAUTHENTICATED_BOB, UNAUTHENTICATED_CAROL, renderApp };
