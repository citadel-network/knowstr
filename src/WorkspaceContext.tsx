import { List, Map, Set } from "immutable";
import React, { createContext, useState } from "react";
import { getReadRelays, useEventQuery } from "citadel-commons";
import { useDefaultWorkspace } from "./NostrAuthContext";
import { MergeKnowledgeDB, useData } from "./DataContext";
import { useProjectContext } from "./ProjectContext";
import { useApis } from "./Apis";
import { KIND_WORKSPACES } from "./nostr";
import { newProcessedEvents, useEventProcessor } from "./Data";
import { fallbackWorkspace, replaceUnauthenticatedUser } from "./planner";
import {
  getWorkspacesWithNodes,
  useWorkspaceFromURL,
} from "./KnowledgeDataContext";
import {
  addWorkspacesToFilter,
  createBaseFilter,
  filtersToFilterArray,
} from "./dataQuery";
import { RootViewContextProvider } from "./ViewContext";

type WorkspaceContextType = {
  activeWorkspace: LongID;
  workspaces: Map<PublicKey, List<ID>>;
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

export function WorkspaceContextProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const defaultWorkspace = useDefaultWorkspace();
  const { user, contacts, publishEventsStatus } = useData();
  const { relayPool } = useApis();
  // If there is no workspace to be found, we create a new one with this ID
  const [fallbackWSID] = useState(fallbackWorkspace(user.publicKey));
  const { userRelays } = useProjectContext();

  const readFromRelays = getReadRelays(userRelays);
  const { events, eose: workspaceConfigEose } = useEventQuery(
    relayPool,
    [
      {
        authors: [user.publicKey, ...contacts.keySeq().toArray()],
        kinds: [KIND_WORKSPACES],
      },
    ],
    { readFromRelays }
  );
  const workspaceEvents = events
    .valueSeq()
    .toList()
    .merge(publishEventsStatus.unsignedEvents);
  const processedEvents = useEventProcessor(workspaceEvents);
  const myProcessedEvents = processedEvents.get(
    user.publicKey,
    newProcessedEvents()
  );
  const wsFromURL = useWorkspaceFromURL();
  const activeWorkspace =
    wsFromURL !== undefined
      ? replaceUnauthenticatedUser(wsFromURL, user.publicKey)
      : myProcessedEvents.activeWorkspace || defaultWorkspace || fallbackWSID;

  const workspaceFilters = processedEvents.reduce((rdx, p) => {
    return addWorkspacesToFilter(rdx, p.workspaces as List<LongID>);
  }, createBaseFilter(contacts, user.publicKey));

  const { events: workspaceNodesEvents } = useEventQuery(
    relayPool,
    filtersToFilterArray(workspaceFilters),
    {
      readFromRelays,
      enabled: workspaceConfigEose,
    }
  );

  const knowledgeDBs = useEventProcessor(
    workspaceNodesEvents
      .valueSeq()
      .toList()
      .merge(publishEventsStatus.unsignedEvents)
  ).map((data) => data.knowledgeDB);

  const workspaces = processedEvents.map((p) => p.workspaces);

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspace,
        workspaces,
      }}
    >
      <MergeKnowledgeDB knowledgeDBs={knowledgeDBs}>
        <RootViewContextProvider root={activeWorkspace}>
          {children}
        </RootViewContextProvider>
      </MergeKnowledgeDB>
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext(): WorkspaceContextType {
  const context = React.useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error(
      "useWorkspaceContext must be used within a WorkspaceContextProvider"
    );
  }
  return context;
}

export function useUserWorkspaces(): List<ID> {
  return useWorkspaceContext().workspaces.get(
    useData().user.publicKey,
    List<ID>()
  );
}

export function useWorkspaceNodes(): List<KnowNode> {
  const { workspaces, activeWorkspace } = useWorkspaceContext();
  const data = useData();
  const allWorkspaces = Set<LongID | ID>(
    workspaces.valueSeq().toList().flatten(1) as List<LongID>
  )
    .concat([activeWorkspace])
    .toSet();
  return getWorkspacesWithNodes(allWorkspaces, data);
}
