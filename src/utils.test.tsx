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
import { Event, matchFilter } from "nostr-tools";
import { DEFAULT_RELAYS } from "./nostr";
import { RequireLogin } from "./AppState";
import {
  createContactsOfContactsQuery,
  createContactsQuery,
  parseContactOfContactsEvents,
  parseContactEvent,
} from "./contacts";
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
import { DEFAULT_SETTINGS } from "./settings";
import {
  KnowledgeDiff,
  compareKnowledgeDB,
  createKnowledgeQuery,
  createKnowledgeDBs,
  parseKnowledgeEvents,
  KnowledgeDiffWithCommits,
  mergeKnowledgeData,
} from "./knowledgeEvents";
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
  const { fileStore, relayPool } = applyApis(options);
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
      <ApiProvider
        apis={{
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
    </BrowserRouter>
  );
  return {
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
  sentEvents: List<Event>(),
  settings: DEFAULT_SETTINGS,
  relays: DEFAULT_RELAYS,
};

export const EMPTY_PLAN = {
  ...DEFAULT_DATA_CONTEXT_PROPS,
  setData: false,
  publishEvents: List<Event>(),
  user: ALICE,
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

function getPrivateContacts(appState: TestAppState): Contacts {
  const query = createContactsQuery([appState.user.publicKey]);
  const events = List<Event>(appState.relayPool.getEvents()).filter((e) =>
    matchFilter(query, e)
  );
  const newestContactsEvent = events.last(undefined);
  if (!newestContactsEvent) {
    return Map<PublicKey, Contact>();
  }
  return parseContactEvent(newestContactsEvent);
}

function getContactsOfContacts(appState: TestAppState): ContactsOfContacts {
  const contacts = getPrivateContacts(appState);
  const query = createContactsOfContactsQuery(contacts);
  const events = List<Event>(appState.relayPool.getEvents()).filter((e) =>
    matchFilter(query, e)
  );
  return parseContactOfContactsEvents(events);
}
export function extractKnowledgeEvents(
  appState: TestAppState
): Map<string, Event> {
  const contacts = getPrivateContacts(appState);
  const contactsOfContacts = getContactsOfContacts(appState);
  const authors = contacts
    .merge(contactsOfContacts)
    .set(appState.user.publicKey, appState.user)
    .keySeq()
    .toArray();
  const query = createKnowledgeQuery(authors);
  return Map<string, Event>(
    List<Event>(appState.relayPool.getEvents())
      .filter((e) => matchFilter(query, e))
      .map((e) => [e.id, e])
  );
}

export function extractKnowledgeDiffs(
  appState: TestAppState,
  events: Map<string, Event>
): Map<string, KnowledgeDiffWithCommits> {
  return parseKnowledgeEvents(
    events,
    Map<string, KnowledgeDiff<BranchWithCommits>>(),
    appState.user.publicKey
  );
}

export function extractKnowledgeDB(appState: TestAppState): KnowledgeData {
  const events = extractKnowledgeEvents(appState);
  const decryptedDiffs = extractKnowledgeDiffs(appState, events);
  return mergeKnowledgeData(
    createKnowledgeDBs(events, decryptedDiffs),
    appState.user.publicKey
  );
}

type UpdateState = () => TestAppState;

export function setup(
  users: KeyPair[],
  options?: Partial<TestAppState>
): UpdateState[] {
  const appState = applyDefaults(options);
  return users.map((user): UpdateState => {
    return (): TestAppState => {
      const updatedState = {
        ...appState,
        user,
      };
      const contacts = appState.contacts.merge(
        getPrivateContacts(updatedState)
      );
      const contactsOfContacts = getContactsOfContacts(updatedState);
      return {
        ...updatedState,
        contacts,
        contactsOfContacts,
      };
    };
  });
}

export async function addContact(
  cU: UpdateState,
  publicKey: PublicKey
): Promise<void> {
  const utils = cU();
  const plan = planEnsurePrivateContact(createPlan(utils), publicKey);
  await execute({
    ...utils,
    plan,
  });
  // TODO: remove if tests are not flaky
  /*
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
   */
}

export async function connectContacts(
  a: UpdateState,
  b: UpdateState
): Promise<void> {
  const aUser = a().user;
  const bUser = b().user;
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
  fireEvent.click(await screen.findByText("Follow"));
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
  const utils = update();
  const plan = createPlan(utils);
  const diff = compareKnowledgeDB<BranchWithCommits>(
    newDB(),
    commitAll(knowledgeData)
  );
  await execute({
    ...utils,
    plan: planSetKnowledgeData(plan, diff),
  });
  const view = renderApp(update());
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
