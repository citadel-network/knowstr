import { List, Map, OrderedMap } from "immutable";
import { UnsignedEvent } from "nostr-tools";
import {
  KIND_DELETE,
  KIND_KNOWLEDGE_LIST,
  KIND_KNOWLEDGE_NODE,
  KIND_RELATION_TYPES,
  KIND_VIEWS,
  KIND_WORKSPACES,
  findTag,
  getMostRecentReplacableEvent,
  sortEvents,
} from "citadel-commons";
import {
  Serializable,
  jsonToViews,
  jsonToWorkspace,
  jsonToRelationTypes,
  eventToRelations,
} from "./serializer";
import { DEFAULT_COLOR } from "./components/RelationTypes";

export function findNodes(events: List<UnsignedEvent>): Nodes {
  const sorted = sortEvents(
    events.filter(
      (event) =>
        event.kind === KIND_KNOWLEDGE_NODE || event.kind === KIND_DELETE
    )
  );
  // use reduce in case of duplicate nodes, the newer version wins
  return sorted.reduce((rdx, event) => {
    if (event.kind === KIND_DELETE) {
      const deleteTag = findTag(event, "a");
      if (!deleteTag) {
        return rdx;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [deleteKind, _, eventToDelete] = deleteTag.split(":");
      if (deleteKind === `${KIND_KNOWLEDGE_NODE}`) {
        return rdx.remove(eventToDelete as ID);
      }
      return rdx;
    }
    const id = findTag(event, "d") as ID;
    if (!id) {
      return rdx;
    }
    return rdx.set(id, {
      id,
      text: event.content,
      author: event.pubkey as PublicKey,
    });
  }, Map<ID, KnowNode>());
}

export function findRelations(events: List<UnsignedEvent>): Map<ID, Relations> {
  const sorted = sortEvents(
    events.filter(
      (event) =>
        event.kind === KIND_KNOWLEDGE_LIST || event.kind === KIND_DELETE
    )
  );
  return sorted.reduce((rdx, event) => {
    if (event.kind === KIND_DELETE) {
      const deleteTag = findTag(event, "a");
      if (!deleteTag) {
        return rdx;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [deleteKind, _, eventToDelete] = deleteTag.split(":");
      if (deleteKind === `${KIND_KNOWLEDGE_LIST}`) {
        return rdx.remove(eventToDelete as ID);
      }
      return rdx;
    }
    const relations = eventToRelations(event);
    if (!relations) {
      return rdx;
    }
    return rdx.set(relations.id, relations);
  }, Map<ID, Relations>());
}

type Workspaces = {
  workspaces: List<ID>;
  activeWorkspace: ID;
};

export function findWorkspaces(
  events: List<UnsignedEvent>
): Workspaces | undefined {
  const workspaceEvent = getMostRecentReplacableEvent(
    events.filter((event) => event.kind === KIND_WORKSPACES)
  );
  if (workspaceEvent === undefined) {
    return undefined;
  }
  const parsed = JSON.parse(workspaceEvent.content) as Serializable;
  return jsonToWorkspace(parsed);
}

export function findViews(events: List<UnsignedEvent>): Views {
  const viewEvent = getMostRecentReplacableEvent(
    events.filter((event) => event.kind === KIND_VIEWS)
  );
  if (viewEvent === undefined) {
    return Map<string, View>();
  }
  return jsonToViews(JSON.parse(viewEvent.content) as Serializable);
}

export function findRelationTypes(events: List<UnsignedEvent>): RelationTypes {
  const relationTypesEvent = getMostRecentReplacableEvent(
    events.filter((event) => event.kind === KIND_RELATION_TYPES)
  );
  if (relationTypesEvent === undefined) {
    return OrderedMap<ID, RelationType>().set("" as ID, {
      color: DEFAULT_COLOR,
      label: "Default",
    });
  }
  return jsonToRelationTypes(
    JSON.parse(relationTypesEvent.content) as Serializable
  );
}
