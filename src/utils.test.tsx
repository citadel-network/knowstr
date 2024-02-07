import React from "react";
import { List, Map } from "immutable";
import {
  render,
  fireEvent,
  screen,
  waitFor,
  MatcherFunction,
  RenderResult,
} from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Event, Filter, matchFilter } from "nostr-tools";
import userEvent from "@testing-library/user-event";
import { hexToBytes } from "@noble/hashes/utils";
import { Container } from "react-dom";
import { DEFAULT_RELAYS, KIND_REPUTATIONS } from "./nostr";
import { RequireLogin } from "./AppState";
import { parseContactEvent } from "./contacts";
import {
  Plan,
  createPlan,
  planEnsurePrivateContact,
  planUpdateWorkspaces,
  planUpsertNode,
  planUpsertRelations,
} from "./planner";
import { execute } from "./executor";
import { ApiProvider, Apis } from "./Apis";
import { App } from "./App";
import { DataContextProps } from "./DataContext";
import { MockRelayPool, mockRelayPool } from "./nostrMock.test";
import { DEFAULT_SETTINGS } from "./settings";
import { NostrAuthContext } from "./NostrAuthContext";
import { FocusContext, FocusContextProvider } from "./FocusContextProvider";
import {
  addRelationToRelations,
  getRelationsNoSocial,
  newNode,
} from "./connections";
import { newRelations } from "./ViewContext";
import { newDB } from "./knowledge";
import { TemporaryViewProvider } from "./components/TemporaryViewContext";
import { DND } from "./dnd";

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
  privateKey: hexToBytes(
    "04d22f1cf58c28647c7b7dc198dcbc4de860948933e56001ab9fc17e1b8d072e"
  ),
};

const UNAUTHENTICATED_BOB: Contact = {
  publicKey: BOB_PUBLIC_KEY,
};

export const BOB: KeyPair = {
  publicKey: BOB_PUBLIC_KEY,
  privateKey: hexToBytes(BOB_PRIVATE_KEY),
};

const UNAUTHENTICATED_CAROL: Contact = {
  publicKey: CAROL_PUBLIC_KEY,
};

export const CAROL: KeyPair = {
  publicKey: CAROL_PUBLIC_KEY,
  privateKey: hexToBytes(CAROL_PRIVATE_KEY),
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
  includeFocusContext?: boolean;
  user?: KeyPair;
};

function renderApis(
  children: React.ReactElement,
  options?: RenderApis
): TestApis & RenderResult {
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
  const utils = render(
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
          {" "}
          {options?.includeFocusContext === true ? (
            <FocusContextProvider>{children}</FocusContextProvider>
          ) : (
            <FocusContext.Provider
              value={{
                isInputElementInFocus: true,
                setIsInputElementInFocus: jest.fn(),
              }}
            >
              {children}
            </FocusContext.Provider>
          )}
        </NostrAuthContext.Provider>
      </ApiProvider>
    </BrowserRouter>
  );
  return {
    fileStore,
    relayPool,
    ...utils,
  };
}

type RenderViewResult = TestApis & RenderResult;

function renderApp(props: RenderApis): RenderViewResult {
  const testApis = applyApis(props);
  return renderApis(<App />, {
    ...testApis,
    includeFocusContext: props.includeFocusContext,
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
  knowledgeDBs: Map<PublicKey, KnowledgeData>(),
};

type TestAppState = DataContextProps & TestApis;

function applyDefaults(props?: Partial<TestAppState>): TestAppState {
  return {
    ...applyApis(props),
    ...DEFAULT_DATA_CONTEXT_PROPS,
    ...props,
  };
}

function createContactsQuery(authors: PublicKey[]): Filter {
  return {
    kinds: [KIND_REPUTATIONS],
    authors,
  };
}

function createContactsOfContactsQuery(contacts: Contacts): Filter {
  const contactsPublicKeys = contacts
    .keySeq()
    .sortBy((k) => k)
    .toArray();
  return createContactsQuery(contactsPublicKeys);
}

function parseContactOfContactsEvents(events: List<Event>): ContactsOfContacts {
  return events.reduce((rdx, event) => {
    return rdx.merge(
      parseContactEvent(event).map((contact) => ({
        ...contact,
        commonContact: event.pubkey as PublicKey,
      }))
    );
  }, Map<PublicKey, ContactOfContact>());
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

export type UpdateState = () => TestAppState;

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
): TestAppState & RenderResult {
  const props = applyDefaults(options);
  const utils = renderApis(
    <Routes>
      <Route element={<RequireLogin />}>
        <Route
          path="*"
          element={
            <TemporaryViewProvider>
              <DND>{children}</DND>
            </TemporaryViewProvider>
          }
        />
      </Route>
    </Routes>,
    props
  );
  return { ...props, ...utils };
}

export async function fillAndSubmitInviteForm(): Promise<void> {
  fireEvent.click(await screen.findByText("Follow"));
  await waitForLoadingToBeNull();
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

export async function typeNewNode(
  view: RenderResult,
  text: string
): Promise<void> {
  userEvent.click(await screen.findByText("Add Note"));
  /* eslint-disable testing-library/no-container */
  /* eslint-disable testing-library/no-node-access */
  const input = view.container.querySelector(".ql-editor") as Element;
  userEvent.type(input, text);
  userEvent.click(await screen.findByText("Add Note"));
  await screen.findByText(text);
}

type NodeDescription = [string, (NodeDescription[] | string[])?];

function createNodesAndRelations(
  plan: Plan,
  currentRelationsID: LongID | undefined,
  nodes: NodeDescription[]
): Plan {
  return List(nodes).reduce((rdx: Plan, nodeDescription: NodeDescription) => {
    const currentRelations = currentRelationsID
      ? getRelationsNoSocial(
          rdx.knowledgeDBs,
          currentRelationsID,
          rdx.user.publicKey
        )
      : undefined;
    const text =
      typeof nodeDescription === "string"
        ? nodeDescription
        : nodeDescription[0];
    const children =
      typeof nodeDescription === "string"
        ? undefined
        : (nodeDescription[1] as NodeDescription[] | undefined);

    const node = newNode(text, rdx.user.publicKey);
    const planWithNode = planUpsertNode(rdx, node);
    // Add Node to current relation
    const planWithUpdatedRelation = currentRelations
      ? planUpsertRelations(
          planWithNode,
          addRelationToRelations(currentRelations, node.id)
        )
      : planWithNode;
    if (children) {
      // Create Relations for children
      const relationForChildren = newRelations(node.id, "", rdx.user.publicKey);
      const planWithRelations = planUpsertRelations(
        planWithUpdatedRelation,
        relationForChildren
      );
      return createNodesAndRelations(
        planWithRelations,
        relationForChildren.id,
        children
      );
    }
    return planWithUpdatedRelation;
  }, plan);
}

type Options = {
  activeWorkspace: string;
};

export function findNodeByText(plan: Plan, text: string): KnowNode | undefined {
  const { knowledgeDBs, user } = plan;
  return knowledgeDBs
    .get(user.publicKey, newDB())
    .nodes.find((node) => node.text === text);
}

export async function setupTestDB(
  appState: TestAppState,
  nodes: NodeDescription[],
  options?: Options
): Promise<Plan> {
  const plan = createNodesAndRelations(createPlan(appState), undefined, nodes);

  const setNewWorkspace =
    options?.activeWorkspace && findNodeByText(plan, options.activeWorkspace);
  const planWithWorkspace = setNewWorkspace
    ? planUpdateWorkspaces(
        plan,
        plan.knowledgeDBs
          .get(plan.user.publicKey, newDB())
          .workspaces.push(setNewWorkspace.id),
        setNewWorkspace.id
      )
    : plan;
  await execute({ ...appState, plan: planWithWorkspace });
  return planWithWorkspace;
}

export function startDragging(
  container: Container,
  draggableID: string
): Element {
  const el = container.querySelector(
    `div[data-rfd-draggable-id="${draggableID}"]`
  );
  if (!el) {
    throw new Error(`Element with drag id ${draggableID} not found`);
  }
  // User event doesn't work to activate dragging on a specific event, the only way to use
  // user event is to cycle through by pressing tab until the element is in focus which is
  // very slow

  // eslint-disable-next-line testing-library/prefer-user-event
  fireEvent.keyDown(el, { keyCode: 32 });
  return el;
}

export function dragUp(el: Element): void {
  // eslint-disable-next-line testing-library/prefer-user-event
  fireEvent.keyDown(el, { keyCode: 38 });
}

export function drop(el: Element): void {
  // eslint-disable-next-line testing-library/prefer-user-event
  fireEvent.keyDown(el, { keyCode: 32 });
}

export function extractNodes(container: Container): Array<string | null> {
  const allDraggables = container.querySelectorAll(
    "[data-rfd-draggable-id] .inner-node .break-word"
  );
  return Array.from(allDraggables).map((el) => el.textContent);
}

export { ALICE, UNAUTHENTICATED_BOB, UNAUTHENTICATED_CAROL, renderApp };
