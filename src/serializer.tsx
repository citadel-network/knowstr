import { Map, OrderedMap, Set, List } from "immutable";
import {
  KnowledgeDiff,
  RepoDiff,
  RepoDiffWithCommits,
} from "./knowledgeEvents";

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

function serializeBranch(
  branchPath: BranchPath | undefined,
  myself: string
): {
  b0: string | undefined;
  b1: string | undefined;
} {
  if (!branchPath) {
    return { b0: undefined, b1: undefined };
  }
  return {
    b0: branchPath[0] === undefined ? myself : branchPath[0],
    b1: branchPath[1],
  };
}

function viewToJSON(attributes: View | null, myself: string): Serializable {
  if (attributes === null) {
    return null;
  }
  return {
    s: attributes.displaySubjects,
    o: attributes.relationType,
    w: attributes.width,
    e: attributes.expanded !== undefined ? attributes.expanded : undefined,
    ...serializeBranch(attributes.branch, myself),
  };
}

function parseBranch(
  remote: Serializable,
  branch: Serializable,
  myself: string
): BranchPath {
  if (toString(remote) === myself) {
    return [undefined, toString(branch)];
  }
  return [toString(remote) as PublicKey, toString(branch)];
}

function jsonToView(view: Serializable, myself: string): View | null {
  if (view === null) {
    return null;
  }
  const a = asObject(view);
  return {
    displaySubjects: asBoolean(a.s),
    relationType: asString(a.o) as RelationType,
    width: asNumber(a.w),
    branch: parseBranch(a.b0, a.b1, myself),
    expanded: a.e !== undefined ? asBoolean(a.e) : undefined,
  };
}

function relationToJSON(relation: Relation): Serializable {
  return {
    i: relation.id,
  };
}

function jsonToRelation(relation: Serializable): Relation {
  const r = asObject(relation);
  return {
    id: asString(r.i),
  };
}

function relationsToJSON(relations: Relations): Serializable {
  return relations.map((r) => relationToJSON(r)).toJSON();
}

export function relationsMapToJSON(
  relationsMap: Map<RelationType, Relations>
): Serializable {
  return relationsMap.map((r) => relationsToJSON(r)).toJSON();
}

function jsonToRelations(relations: Serializable): Relations {
  return List(asArray(relations)).map((r) => jsonToRelation(r));
}

function jsonToRelationsMap(
  relationsMap: Serializable
): Map<RelationType, Relations> {
  return Map(asObject(relationsMap))
    .map((r) => jsonToRelations(r))
    .mapKeys((t) => {
      if (t === "CHRON") {
        return "CONTAINS";
      }
      return t as RelationType;
    });
}

export function nodeToJSON(node: KnowNode): Serializable {
  return {
    t: node.text,
    n: node.nodeType,
    r: relationsMapToJSON(node.relations),
  };
}

function branchToJSON(branch: BranchWithCommits): Serializable {
  return branch.origin && branch.origin[0] !== undefined
    ? {
        h: branch.head,
        o: [branch.origin[0], branch.origin[1]],
      }
    : { h: branch.head };
}

function jsonToOrigin(origin: Serializable): [PublicKey, string] | undefined {
  if (!origin) {
    return undefined;
  }
  const arr = asArray(origin);
  if (arr.length === 2) {
    return [asString(arr[0]) as PublicKey, asString(arr[1])];
  }
  return undefined;
}

function jsonToBranch(branch: Serializable): BranchWithCommits {
  const b = asObject(branch);
  return {
    head: asString(b.h),
    origin: jsonToOrigin(b.o),
  };
}

function branchesToJSON(
  branches: Map<string, BranchWithCommits>
): Serializable {
  return branches.map(branchToJSON).toJSON();
}

function jsonToBranches(
  branches: Serializable
): Map<string, BranchWithCommits> {
  return Map(asObject(branches)).map(jsonToBranch);
}

function jsonToNode(node: Serializable): KnowNode {
  const n = asObject(node);
  return {
    text: asString(n.t),
    nodeType: asString(n.n) as NodeType,
    relations: jsonToRelationsMap(n.r),
  };
}

function commitToJSON(commit: Commit): Serializable {
  return {
    p: commit.parents.toArray(),
    d: commit.date.getTime(),
  };
}

function jsonToCommit(commit: Serializable, hash: Hash): Commit {
  return {
    date: new Date(asNumber(asObject(commit).d)),
    hash,
    parents: Set(asArray(asObject(commit).p).map(asString)),
  };
}

function commitsToJSON(commits: Map<Hash, Commit>): Serializable {
  return commits.map(commitToJSON).toJSON();
}

function jsonToCommits(commits: Serializable): Map<Hash, Commit> {
  return OrderedMap(asObject(commits)).map(jsonToCommit);
}

function nodesToJSON(nodes: Map<string, KnowNode>): Serializable {
  return nodes.map((n) => nodeToJSON(n)).toJSON();
}

function jsonToNodes(nodes: Serializable): Map<string, KnowNode> {
  return Map(asObject(nodes)).map((n) => jsonToNode(n));
}

export function repoToJSON(repo: RepoWithCommits): Serializable {
  const s = {
    i: repo.id,
    c: commitsToJSON(repo.commits),
    o: nodesToJSON(repo.objects),
  };
  return repo.branches.isEmpty()
    ? s
    : { ...s, b: branchesToJSON(repo.branches) };
}

function repoDiffToJSON(repoDiff: RepoDiffWithCommits | null): Serializable {
  if (repoDiff === null) {
    return null;
  }
  if (!repoDiff.commits && !repoDiff.objects && !repoDiff.branches) {
    return undefined;
  }
  return {
    c:
      repoDiff.commits && repoDiff.commits.size > 0
        ? commitsToJSON(repoDiff.commits)
        : undefined,
    o:
      repoDiff.objects && repoDiff.objects.size > 0
        ? nodesToJSON(repoDiff.objects)
        : undefined,
    b:
      repoDiff.branches && repoDiff.branches.size > 0
        ? branchesToJSON(repoDiff.branches)
        : undefined,
  };
}

export function jsonToRepo(repo: Serializable): RepoWithCommits {
  const r = asObject(repo);
  return {
    id: asString(r.i),
    commits: jsonToCommits(r.c),
    objects: jsonToNodes(r.o),
    branches: r.b ? jsonToBranches(r.b) : Map<string, BranchWithCommits>(),
    remotes: Map<PublicKey, Map<string, BranchWithCommits>>(),
  };
}

function jsonToRepoDiff(repoDiff: Serializable): RepoDiffWithCommits | null {
  if (repoDiff === null) {
    return null;
  }
  const r = asObject(repoDiff);
  return {
    commits: r.c ? jsonToCommits(r.c) : undefined,
    objects: r.o ? jsonToNodes(r.o) : undefined,
    branches: r.b ? jsonToBranches(r.b) : undefined,
  };
}

function jsonToViews(
  s: Serializable,
  myself: string
): Map<string, View | null> {
  return Map(asObject(s)).map((v) => jsonToView(v, myself));
}

export function viewsToJSON(
  views: Map<string, View | null>,
  myself: string
): Serializable {
  return views.map((v) => viewToJSON(v, myself)).toJSON();
}

function repoDiffsToJSON(
  repoDiffs: Map<string, RepoDiff<BranchWithCommits> | null>
): Serializable {
  return repoDiffs
    .map((r) => repoDiffToJSON(r))
    .filter((r) => r !== undefined)
    .toJSON();
}

function jsonToRepoDiffs(
  s: Serializable | undefined
): Map<string, RepoDiff<BranchWithCommits> | null> | undefined {
  if (!s) {
    return undefined;
  }
  return OrderedMap(asObject(s)).map((j) => jsonToRepoDiff(j));
}

export function diffToJSON(
  diff: KnowledgeDiff<BranchWithCommits>,
  myself: PublicKey
): Serializable {
  return {
    r: diff.repos ? repoDiffsToJSON(diff.repos) : undefined,
    a: diff.activeWorkspace,
    v: diff.views ? viewsToJSON(diff.views, myself) : undefined,
  };
}

// TODO: get rid of myself parameter
export function jsonToDiff(
  diff: Serializable,
  myself: PublicKey
): KnowledgeDiff<BranchWithCommits> {
  const d = asObject(diff);
  const repos = jsonToRepoDiffs(d.r);
  const activeWorkspace = d.a ? asString(d.a) : undefined;
  const views = d.v ? jsonToViews(d.v, myself) : undefined;
  return {
    repos,
    activeWorkspace,
    views,
  };
}
