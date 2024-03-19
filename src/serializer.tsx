import { Map, List, OrderedMap } from "immutable";
import { UnsignedEvent } from "nostr-tools";
import { findAllTags, findTag } from "citadel-commons";
import { parseViewPath } from "./ViewContext";
import { joinID } from "./connections";

export type Serializable =
  | string
  | number
  | boolean
  | { [key: string]: Serializable }
  | Array<Serializable>
  | null
  // JSON doesn't have an undefined value, so fields with undefined will be omitted
  | undefined;

function toString(serializable: Serializable | undefined): string {
  return serializable === undefined || serializable === null
    ? "undefined"
    : serializable.toString();
}

function asObject(obj: Serializable | undefined): {
  [key: string]: Serializable;
} {
  if (typeof obj === "object" && !Array.isArray(obj) && obj !== null) {
    return obj;
  }
  throw new Error(`${toString(obj)} is not an object`);
}

function asString(obj: Serializable | undefined): string {
  if (typeof obj === "string") {
    return obj;
  }
  throw new Error(`${toString(obj)} is not a string`);
}

function asNumber(obj: Serializable | undefined): number {
  if (typeof obj === "number") {
    return obj;
  }
  throw new Error(`${toString(obj)} is not a number`);
}

function asBoolean(obj: Serializable | undefined): boolean {
  if (typeof obj === "boolean") {
    return obj;
  }
  throw new Error(`${toString(obj)} is not a boolean`);
}

function asArray(obj: Serializable | undefined): Array<Serializable> {
  if (Array.isArray(obj)) {
    return obj;
  }
  throw new Error(`${toString(obj)} is not an array`);
}

function viewToJSON(attributes: View): Serializable {
  return {
    s: attributes.displaySubjects,
    o: attributes.relations,
    w: attributes.width,
    e: attributes.expanded !== undefined ? attributes.expanded : undefined,
  };
}

function jsonToView(view: Serializable): View | undefined {
  if (view === null || view === undefined) {
    return undefined;
  }
  const a = asObject(view);
  return {
    displaySubjects: asBoolean(a.s),
    relations: a.o !== undefined ? (asString(a.o) as LongID) : undefined,
    width: asNumber(a.w),
    expanded: a.e !== undefined ? asBoolean(a.e) : undefined,
  };
}

export function jsonToWorkspace(
  workspaces: Serializable
): { workspaces: List<LongID>; activeWorkspace: LongID } | undefined {
  if (workspaces === undefined) {
    return undefined;
  }
  const w = asObject(workspaces);
  return {
    workspaces: List<LongID>(asArray(w.w).map((i) => asString(i) as LongID)),
    activeWorkspace: asString(w.a) as LongID,
  };
}

export function jsonToViews(s: Serializable): Map<string, View> {
  return Map(asObject(s))
    .map((v) => jsonToView(v))
    .filter((v, k) => {
      if (v === undefined) {
        return false;
      }
      try {
        // Test if view path is valid
        parseViewPath(k);
        return true;
      } catch {
        return false;
      }
    }) as Map<string, View>;
}

export function jsonToRelationTypes(s: Serializable): RelationTypes {
  return OrderedMap(asObject(s))
    .map((relationType) => {
      try {
        const obj = asObject(relationType);
        if (obj.c === undefined || obj.l === undefined) {
          return undefined;
        }
        return { color: asString(obj.c), label: asString(obj.l) };
      } catch {
        return undefined;
      }
    })
    .filter((v) => v !== undefined) as RelationTypes;
}

export function relationTypesToJson(
  relationTypes: RelationTypes
): Serializable {
  return relationTypes.map((v) => ({ c: v.color, l: v.label })).toJSON();
}

export function viewsToJSON(views: Map<string, View>): Serializable {
  return views.map((v) => viewToJSON(v)).toJSON();
}

export function eventToRelations(e: UnsignedEvent): Relations | undefined {
  const id = findTag(e, "d");
  const head = findTag(e, "k") as ID;
  const type = findTag(e, "rel_type");
  const updated = e.created_at;
  if (id === undefined || head === undefined || type === undefined) {
    return undefined;
  }
  const itemsAsTags = findAllTags(e, "i") || [];
  const items = List(itemsAsTags.map((i) => i[0] as LongID));
  return {
    id: joinID(e.pubkey, id),
    head,
    type,
    updated,
    items,
  };
}
