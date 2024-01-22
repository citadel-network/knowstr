import { List, Map, OrderedMap } from "immutable";
import { Event } from "nostr-tools";
import {
  findTag,
  getMostRecentReplacableEvent,
  sortEvents,
} from "citadel-commons";
import {
  KIND_DELETE,
  KIND_KNOWLEDGE_LIST,
  KIND_KNOWLEDGE_NODE,
  KIND_RELATION_TYPES,
  KIND_VIEWS,
  KIND_WORKSPACES,
} from "./nostr";
import {
  jsonToRelations,
  Serializable,
  jsonToViews,
  jsonToWorkspace,
  jsonToRelationTypes,
} from "./serializer";
import { joinID } from "./connections";
import { DEFAULT_COLOR } from "./components/RelationTypes";

export function findNodes(events: List<Event>): Map<string, KnowNode> {
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
        return rdx.remove(eventToDelete);
      }
      return rdx;
    }
    const id = findTag(event, "d");
    if (!id) {
      return rdx;
    }
    return rdx.set(id, {
      id: joinID(event.pubkey, id),
      text: event.content,
    });
  }, Map<string, KnowNode>());
}

export function findRelations(events: List<Event>): Map<string, Relations> {
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
        return rdx.remove(eventToDelete);
      }
      return rdx;
    }
    const id = findTag(event, "d");
    if (!id) {
      return rdx;
    }
    const relations = jsonToRelations(
      JSON.parse(event.content) as Serializable
    );
    if (!relations) {
      return rdx;
    }
    return rdx.set(id, {
      ...relations,
      id: joinID(event.pubkey, id),
    });
  }, Map<string, Relations>());
}

type Workspaces = {
  workspaces: List<LongID>;
  activeWorkspace: LongID;
};

export function findWorkspaces(events: List<Event>): Workspaces | undefined {
  const workspaceEvent = getMostRecentReplacableEvent(
    events.filter((event) => event.kind === KIND_WORKSPACES)
  );
  if (workspaceEvent === undefined) {
    return undefined;
  }
  const parsed = JSON.parse(workspaceEvent.content) as Serializable;
  return jsonToWorkspace(parsed);
}

export function findViews(events: List<Event>): Views {
  const viewEvent = getMostRecentReplacableEvent(
    events.filter((event) => event.kind === KIND_VIEWS)
  );
  if (viewEvent === undefined) {
    return Map<string, View>();
  }
  return jsonToViews(JSON.parse(viewEvent.content) as Serializable);
}

export function findRelationTypes(events: List<Event>): RelationTypes {
  const relationTypesEvent = getMostRecentReplacableEvent(
    events.filter((event) => event.kind === KIND_RELATION_TYPES)
  );
  if (relationTypesEvent === undefined) {
    return OrderedMap<ID, RelationType>().set("", {
      color: DEFAULT_COLOR,
      label: "Default",
    });
  }
  return jsonToRelationTypes(
    JSON.parse(relationTypesEvent.content) as Serializable
  );
}
