import { Map, List } from "immutable";

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
    relations: asString(a.o) as LongID,
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
    .filter((v) => v !== undefined) as Map<string, View>;
}

export function viewsToJSON(views: Map<string, View>): Serializable {
  return views.map((v) => viewToJSON(v)).toJSON();
}

export function relationsToJSON(relations: Relations): Serializable {
  return {
    l: relations.items.toArray(),
    h: relations.head,
    t: relations.type,
  };
}

export function jsonToRelations(
  s: Serializable | undefined
): Omit<Relations, "id"> | undefined {
  if (!s) {
    return undefined;
  }
  const r = asObject(s);
  const items = List(asArray(r.l)).map((i) => asString(i) as LongID);
  return {
    items,
    head: asString(r.h) as LongID,
    type: asString(r.t) as RelationType,
  };
}
