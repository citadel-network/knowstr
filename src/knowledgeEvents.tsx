import { List, Map } from "immutable";
import { UnsignedEvent } from "nostr-tools";
import {
  findTag,
  getMostRecentReplacableEvent,
  sortEvents,
} from "citadel-commons";
import {
  KIND_DELETE,
  KIND_KNOWLEDGE_LIST,
  KIND_KNOWLEDGE_NODE,
  KIND_VIEWS,
  KIND_WORKSPACES,
} from "./nostr";
import {
  Serializable,
  jsonToViews,
  jsonToWorkspace,
  eventToRelations,
} from "./serializer";
import { joinID, splitID } from "./connections";

export function findNodes(events: List<UnsignedEvent>): Map<string, KnowNode> {
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
      const [deleteKind, userPublicKey, eventToDeleteId] = deleteTag.split(":");
      const eventToDelete = rdx.get(eventToDeleteId);
      const isDeletedByAuthor =
        !!eventToDelete && userPublicKey === eventToDelete.id.split(":")[0];
      const isDeletedByMyself = userPublicKey === event.pubkey;
      // ignore delete events if not done by the author or by myself
      if (
        deleteKind === `${KIND_KNOWLEDGE_NODE}` &&
        (isDeletedByAuthor || isDeletedByMyself)
      ) {
        return rdx.remove(eventToDeleteId);
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

export function findRelations(
  events: List<UnsignedEvent>
): Map<string, Relations> {
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
      const [deleteKind, userPublicKey, eventToDeleteId] = deleteTag.split(":");
      const eventToDelete = rdx.get(eventToDeleteId);
      const isDeletedByAuthor =
        !!eventToDelete && userPublicKey === eventToDelete.id.split(":")[0];
      const isDeletedByMyself = userPublicKey === event.pubkey;
      // ignore delete events if not done by the author or by myself
      if (
        deleteKind === `${KIND_KNOWLEDGE_LIST}` &&
        (isDeletedByAuthor || isDeletedByMyself)
      ) {
        return rdx.remove(eventToDeleteId);
      }
      return rdx;
    }
    const relations = eventToRelations(event);
    if (!relations) {
      return rdx;
    }
    const id = splitID(relations.id)[1];
    return rdx.set(id, relations);
  }, Map<string, Relations>());
}

type Workspaces = {
  workspaces: List<LongID>;
  activeWorkspace: LongID;
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
