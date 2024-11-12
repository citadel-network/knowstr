import { Map } from "immutable";
import { getReadRelays, getWriteRelays } from "./commoncomponents/relaysUtils";
import { useProjectContext } from "./ProjectContext";
import { useData } from "./DataContext";
import { useDefaultRelays } from "./NostrAuthContext";

export function flattenRelays(relays: Map<PublicKey, Relays>): Relays {
  return relays.reduce((acc: Relays, v) => [...acc, ...v], []);
}

function useContactsRelays(): Relays {
  return flattenRelays(useData().contactsRelays);
}

export function useReadRelays({
  defaultRelays,
  user,
  project,
  contacts,
}: WriteRelayConf): Relays {
  const { userRelays, projectRelays } = useProjectContext();
  return [
    ...getReadRelays([
      ...(defaultRelays ? useDefaultRelays() : []),
      ...(user ? userRelays : []),
      ...(project ? projectRelays : []),
    ]),
    ...getWriteRelays(contacts ? useContactsRelays() : []),
  ];
}

// This can be called while contacts is not loaded yet
export function usePreloadRelays({
  defaultRelays,
  user,
  project,
}: Omit<WriteRelayConf, "contacts">): Relays {
  const def = useDefaultRelays();
  const { userRelays, projectRelays } = useProjectContext();
  return getReadRelays([
    ...(defaultRelays ? def : []),
    ...(user ? userRelays : []),
    ...(project ? projectRelays : []),
  ]);
}

export function applyWriteRelayConfig(
  defaultRelays: Relays,
  userRelays: Relays,
  projectRelays: Relays,
  contactsRelays: Relays,
  isProject: boolean,
  config?: WriteRelayConf
): Relays {
  if (!config) {
    return getWriteRelays(isProject ? projectRelays : userRelays);
  }
  if (
    config.project &&
    (config.defaultRelays || config.user || config.contacts)
  ) {
    throw new Error(
      "Project Data needs to be private and not shared with other relays."
    );
  }
  return getWriteRelays([
    ...(config.defaultRelays ? defaultRelays : []),
    ...(config.user ? userRelays : []),
    ...(config.project ? projectRelays : []),
    ...(config.contacts ? contactsRelays : []),
    ...(config.extraRelays ? config.extraRelays : []),
  ]);
}

export function useRelaysToCreatePlan(): AllRelays {
  const defaultRelays = useDefaultRelays();
  const { userRelays, projectRelays } = useProjectContext();
  const { contactsRelays } = useData();
  return {
    defaultRelays,
    userRelays,
    projectRelays,
    contactsRelays: flattenRelays(contactsRelays),
  };
}

export function useRelaysForRelayManagement(): Relays {
  const { projectRelays, userRelays, projectID } = useProjectContext();
  return projectID ? projectRelays || [] : userRelays || [];
}
