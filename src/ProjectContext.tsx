import React, { createContext, useContext, useState } from "react";
import { List, Map } from "immutable";
import { UnsignedEvent } from "nostr-tools";
import {
  createRelaysQuery,
  findAllRelays,
  findTag,
  getMostRecentReplacableEvent,
  useEventQuery,
} from "./commons/useNostrQuery";
import { getReadRelays, mergeRelays, sanitizeRelays } from "./relays";
import { KIND_JOIN_PROJECT, KIND_PROJECT } from "./nostr";
import { splitID } from "./connections";
import { findNodes } from "./knowledgeEvents";
import {
  isUserLoggedIn,
  useDefaultRelays,
  useUserOrAnon,
} from "./NostrAuthContext";
import { useApis } from "./Apis";

function getProjectFromURLSearchParam(): string | undefined {
  const urlSearchParams = new URLSearchParams(window.location.search);
  const project = urlSearchParams.get("project");
  return project || undefined;
}

type ProjectInfo = {
  project: ProjectNode | undefined;
  projectID: LongID | undefined;
  // The relays the user configures for himself, equal to relays except in project context
  userRelays: Relays;
  projectRelays: Relays;
  isRelaysLoaded: boolean;
  setProjectID: React.Dispatch<React.SetStateAction<string | undefined>>;
  bookmarkedProjects: BookmarkedProjects;
};

const ProjectContext = createContext<ProjectInfo | undefined>(undefined);

export function LoadProject(): JSX.Element {
  return <div aria-label="loading" className="spinner-border" />;
}

function processRelayEvents(
  relaysEvents: List<UnsignedEvent>,
  defaultRelays: Relays
): Relays {
  const newestEvent = getMostRecentReplacableEvent(relaysEvents);
  const myRelays = newestEvent ? findAllRelays(newestEvent) : defaultRelays;
  return sanitizeRelays(myRelays);
}

function useLoadProjectBookmarks(relays: Relays): BookmarkedProjects {
  const { relayPool } = useApis();
  const user = useUserOrAnon();
  const { events } = useEventQuery(
    relayPool,
    [
      {
        kinds: [KIND_JOIN_PROJECT],
        authors: [user.publicKey],
      },
    ],
    { enabled: isUserLoggedIn(user), readFromRelays: getReadRelays(relays) }
  );
  return events
    .valueSeq()
    .map((event) => findTag(event, "project") as LongID | undefined)
    .toSet()
    .remove(undefined)
    .toList() as List<LongID>;
}

export function ProjectContextProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [projectID, setProjectID] = useState<string | undefined>(
    getProjectFromURLSearchParam()
  );
  const user = useUserOrAnon();
  const [userID, id] = projectID ? splitID(projectID) : [undefined, undefined];
  const defaultRelays = useDefaultRelays();
  const { relayPool } = useApis();
  const { events: relaysEvents, eose: relaysEose } = useEventQuery(
    relayPool,
    [createRelaysQuery([user.publicKey])],
    { readFromRelays: defaultRelays }
  );
  const userRelays = processRelayEvents(
    relaysEvents.valueSeq().toList(),
    defaultRelays
  );
  const mergedRelays = mergeRelays(
    sanitizeRelays(defaultRelays),
    sanitizeRelays(userRelays)
  );
  const userRelaysRead = getReadRelays(mergedRelays);

  const bookmarkedProjects = useLoadProjectBookmarks(mergedRelays);

  // Load project
  const { events } = useEventQuery(
    relayPool,
    id
      ? [
          {
            kinds: [KIND_PROJECT],
            "#d": [id],
            ...(userID ? { authors: [userID] } : {}),
          },
        ]
      : [],
    { enabled: !!id, readFromRelays: userRelaysRead }
  );
  const project = (
    findNodes(events.valueSeq().toList() || List<UnsignedEvent>()) as Map<
      string,
      ProjectNode
    >
  ).first(undefined);

  const isRelaysLoaded = projectID ? !!project : relaysEose;

  return (
    <ProjectContext.Provider
      value={{
        projectID: projectID ? (projectID as LongID) : undefined,
        project,
        setProjectID,
        isRelaysLoaded,
        userRelays,
        projectRelays: projectID ? project?.relays || [] : [],
        bookmarkedProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext(): ProjectInfo {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectContextProvider");
  }
  return context;
}

export function useIsProjectReady(): boolean {
  const { projectID, project } = useProjectContext();
  // if a project should be loaded but it's not yet, return false
  if (projectID && !project) {
    return false;
  }
  return true;
}
