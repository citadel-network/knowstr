import { is, List, Map } from "immutable";
import { Filter, Event } from "nostr-tools";
import {
  findTag,
  getMostRecentReplacableEvent,
  sortEvents,
} from "citadel-commons";
import {
  KIND_KNOWLEDGE,
  KIND_KNOWLEDGE_LIST,
  KIND_KNOWLEDGE_NODE,
  KIND_VIEWS,
  KIND_WORKSPACES,
} from "./nostr";
import {
  jsonToDiff,
  jsonToRelations,
  Serializable,
  jsonToViews,
} from "./serializer";
import { newDB } from "./knowledge";

export type RepoDiff<T extends BranchWithCommits | BranchWithStaged> = {
  commits?: Map<Hash, Commit>;
  objects?: Map<Hash, KnowNode>;
  branches?: Map<string, T>;
  // Remotes are readonly
};

export type RepoDiffWithCommits = RepoDiff<BranchWithCommits>;

export type KnowledgeDiff<T extends BranchWithCommits | BranchWithStaged> = {
  repos?: Map<string, RepoDiff<T> | null>;
  activeWorkspace?: string;
  views?: Map<string, View | null>;
};

export type KnowledgeDiffWithCommits = KnowledgeDiff<BranchWithCommits>;

function isNodeEqual(a: KnowNode, b: KnowNode): boolean {
  return (
    a.nodeType === b.nodeType &&
    a.text === b.text &&
    is(a.relations, b.relations)
  );
}

function isBranchDiff(oldBranch: Branch, newBranch: Branch): boolean {
  if (oldBranch.head !== newBranch.head) {
    return true;
  }
  if (oldBranch.staged === undefined && newBranch.staged === undefined) {
    return false;
  }
  if (oldBranch.staged === undefined || newBranch.staged === undefined) {
    return true;
  }
  return !isNodeEqual(oldBranch.staged, newBranch.staged);
}

// TODO: after streaming diffs, data are not atomic anymore, we need to handle
// that repos, branches, remotes etc. cannot be found

// commits all data and stores changes into nostr
function compareRepo<T extends BranchWithCommits | BranchWithStaged>(
  base: Repo<T>,
  newRepo: Repo<T>
): RepoDiff<T> | undefined {
  const commitDiff = newRepo.commits.removeAll(base.commits.keySeq());
  const objectDiff = newRepo.objects.removeAll(base.objects.keySeq());
  const branchDiff = newRepo.branches
    .map((newBranch, name) => {
      const oldBranch = base.branches.get(name);
      if (!oldBranch) {
        return newBranch;
      }
      if (isBranchDiff(oldBranch, newBranch)) {
        return newBranch;
      }
      return undefined;
    })
    .filter((branch) => branch !== undefined) as Map<string, T>;
  if (commitDiff.size === 0 && objectDiff.size === 0 && branchDiff.size === 0) {
    return undefined;
  }
  return {
    commits: commitDiff.size > 0 ? commitDiff : undefined,
    objects: objectDiff.size > 0 ? objectDiff : undefined,
    branches: branchDiff.size > 0 ? branchDiff : undefined,
  };
}

function isViewEqual(base: View, newView: View): boolean {
  return (
    base.displaySubjects === newView.displaySubjects &&
    base.relationType === newView.relationType &&
    base.width === newView.width &&
    isBranchEqual(base.branch, newView.branch) &&
    base.expanded === newView.expanded
  );
}

function compareRepos<T extends BranchWithCommits | BranchWithStaged>(
  base: Map<string, Repo<T>>,
  newRepos: Map<string, Repo<T>>
): Map<string, RepoDiff<T> | null> {
  const newReposDiff: Map<string, RepoDiff<T>> = newRepos
    .filter((newRepo) => !base.has(newRepo.id))
    .map(
      (repo): RepoDiff<T> => ({
        commits: repo.commits,
        objects: repo.objects,
        branches: repo.branches,
      })
    );
  return newReposDiff
    .merge(
      base.map((baseRepo): RepoDiff<T> | null | undefined => {
        const newRepo = newRepos.get(baseRepo.id);
        if (!newRepo) {
          // Repo got deleted
          return null;
        }
        return compareRepo(baseRepo, newRepo);
      })
    )
    .filter((diff) => diff !== undefined) as Map<string, RepoDiff<T> | null>;
}

function compareViews(
  base: Map<string, View>,
  newViews: Map<string, View>
): Map<string, View | null> {
  const newViewsDiff = newViews.filter((view, viewID) => !base.has(viewID));
  return newViewsDiff.merge(
    base
      .map((baseView, viewID) => {
        const newView = newViews.get(viewID);
        if (!newView) {
          // view got deleted
          return null;
        }
        if (isViewEqual(baseView, newView)) {
          return undefined;
        }
        return newView;
      })
      .filter((v) => v !== undefined) as Map<string, View | null>
  );
}

export function compareKnowledgeDB<
  T extends BranchWithCommits | BranchWithStaged
>(base: KnowledgeData<T>, newData: KnowledgeData<T>): KnowledgeDiff<T> {
  const reposDiff = compareRepos(base.repos, newData.repos);
  const viewDiff = compareViews(base.views, newData.views);
  return {
    repos: reposDiff.size > 0 ? reposDiff : undefined,
    activeWorkspace:
      newData.activeWorkspace !== base.activeWorkspace
        ? newData.activeWorkspace
        : undefined,
    views: viewDiff.size > 0 ? viewDiff : undefined,
  };
}

function applyRepoDiff<T extends BranchWithCommits | BranchWithStaged>(
  base: Repo<T>,
  diff: RepoDiff<T>
): Repo<T> {
  return {
    ...base,
    commits: diff.commits ? base.commits.merge(diff.commits) : base.commits,
    objects: diff.objects ? base.objects.merge(diff.objects) : base.objects,
    branches: diff.branches
      ? base.branches.merge(diff.branches)
      : base.branches,
  };
}

function applyRepoDiffs<T extends BranchWithCommits | BranchWithStaged>(
  base: Map<string, Repo<T>>,
  diff: Map<string, RepoDiff<T> | null>
): Map<string, Repo<T>> {
  const newRepos = (
    diff.filter((repoDiff, id) => repoDiff !== null && !base.has(id)) as Map<
      string,
      RepoDiff<T>
    >
  ).map(
    (repoDiff, id): Repo<T> => ({
      id,
      commits: repoDiff.commits || Map<Hash, Commit>(),
      objects: repoDiff.objects || Map<Hash, KnowNode>(),
      branches: repoDiff.branches || Map<string, T>(),
      remotes: Map<PublicKey, Map<string, BranchWithCommits>>(),
    })
  );
  return newRepos.merge(
    base
      .map((baseRepo): Repo<T> | undefined => {
        const repoDiff = diff.get(baseRepo.id);
        if (repoDiff === undefined) {
          return baseRepo;
        }
        // Repo got deleted
        if (repoDiff === null) {
          return undefined;
        }
        return applyRepoDiff(baseRepo, repoDiff);
      })
      .filter((repo) => repo !== undefined) as Map<string, Repo<T>>
  );
}

function applyViewDiffs(
  base: Map<string, View>,
  diff: Map<string, View | null>
): Map<string, View> {
  const newViews = diff.filter(
    (view, id) => !base.has(id) && view !== null
  ) as Map<string, View>;
  return newViews.merge(
    base
      .map((baseView, id): View | undefined => {
        const newView = diff.get(id);
        if (newView === undefined) {
          return baseView;
        }
        if (newView === null) {
          return undefined;
        }
        return newView;
      })
      .filter((view) => view !== undefined) as Map<string, View>
  );
}

export function applyDiff<T extends BranchWithCommits | BranchWithStaged>(
  base: KnowledgeData<T>,
  diff: KnowledgeDiff<T>
): KnowledgeData<T> {
  return {
    views: diff.views ? applyViewDiffs(base.views, diff.views) : base.views,
    activeWorkspace: diff.activeWorkspace
      ? diff.activeWorkspace
      : base.activeWorkspace,
    repos: diff.repos ? applyRepoDiffs(base.repos, diff.repos) : base.repos,
  };
}

export function createKnowledgeQuery(authors: string[]): Filter<number> {
  return {
    kinds: [KIND_KNOWLEDGE],
    authors,
  };
}

export function parseKnowledgeEvents(
  events: Map<string, Event>,
  existingDiffs: Map<string, KnowledgeDiffWithCommits>,
  myself: PublicKey
): Map<string, KnowledgeDiffWithCommits> {
  return events.reduce((rdx, event) => {
    if (rdx.has(event.id)) {
      return rdx;
    }
    try {
      const compressedDiff = JSON.parse(event.content) as Serializable;
      return rdx.set(event.id, jsonToDiff(compressedDiff, myself));
    } catch (e) {
      // TODO: Store failures as null to avoid retrying the same blob over and over again?
      return rdx;
    }
  }, existingDiffs);
}

function mergeDB(
  base: KnowledgeDataWithCommits,
  merge: KnowledgeDataWithCommits,
  remote: PublicKey,
  myRemote: PublicKey
): KnowledgeDataWithCommits {
  const repos = merge.repos.reduce((rdx, repo) => {
    const baseRepo = rdx.get(repo.id);
    if (baseRepo) {
      const updatedRepo = pull(baseRepo, repo, remote, myRemote);
      return rdx.set(repo.id, updatedRepo);
    }
    return rdx.set(repo.id, clone(repo, remote));
  }, base.repos);
  return {
    ...base,
    repos,
  };
}

export function createKnowledgeDBs(
  events: Map<string, Event>,
  decryptedDiffs: Map<string, KnowledgeDiffWithCommits>
): Map<PublicKey, KnowledgeDataWithCommits> {
  const sortedEvents = sortEvents(events.toList());
  return sortedEvents.reduce((rdx, event) => {
    const diff = decryptedDiffs.get(event.id);
    if (!diff) {
      return rdx;
    }
    const author = event.pubkey as PublicKey;
    const currentDB = rdx.get(author, newDB());
    const knowledgeWithDiff = applyDiff(currentDB, diff);
    return rdx.set(author, knowledgeWithDiff);
  }, Map<PublicKey, KnowledgeDataWithCommits>());
}

export function mergeKnowledgeData(
  knowledgeDBs: Map<PublicKey, KnowledgeDataWithCommits>,
  myself: PublicKey
): KnowledgeDataWithCommits {
  const myDB = knowledgeDBs.get(myself, newDB());
  return knowledgeDBs.remove(myself).reduce((rdx, db, author) => {
    return mergeDB(rdx, db, author, myself);
  }, myDB);
}

function parseEvents(
  events: List<Event>,
  myself: PublicKey
): Map<string, KnowledgeDiffWithCommits> {
  return events.reduce((rdx, event) => {
    try {
      const compressedDiff = JSON.parse(event.content) as Serializable;
      return rdx.set(event.id, jsonToDiff(compressedDiff, myself));
    } catch (e) {
      return rdx;
    }
  }, Map<string, KnowledgeDiffWithCommits>());
}

export function findKnowledgeDB(
  events: List<Event>,
  myself: PublicKey
): KnowledgeData {
  const filtered = events.filter((event) => event.kind === KIND_KNOWLEDGE);
  const sorted = sortEvents(filtered);
  const diffs = parseEvents(sorted, myself);

  return diffs.reduce((rdx, diff) => applyDiff(rdx, diff), newDB());
}

export function findNodes(events: List<Event>): Map<string, KnowNode> {
  const sorted = sortEvents(
    events.filter((event) => event.kind === KIND_KNOWLEDGE_NODE)
  );
  // use reduce in case of duplicate nodes, the newer version wins
  return sorted.reduce((rdx, event) => {
    const id = findTag(event, "d");
    if (!id) {
      return rdx;
    }
    return rdx.set(id, {
      id: `${event.pubkey}:${id}`,
      text: event.content,
    });
  }, Map<string, KnowNode>());
}

export function findRelations(events: List<Event>): Map<string, Relations> {
  const sorted = sortEvents(
    events.filter((event) => event.kind === KIND_KNOWLEDGE_LIST)
  );
  return sorted.reduce((rdx, event) => {
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
      id: `${event.pubkey}:${id}`,
    });
  }, Map<string, Relations>());
}

type Workspaces = {
  workspaces: List<ID>;
  activeWorkspace: ID;
};

export function findWorkspaces(events: List<Event>): Workspaces | undefined {
  const workspaceEvent = getMostRecentReplacableEvent(
    events.filter((event) => event.kind === KIND_WORKSPACES)
  );
  if (workspaceEvent === undefined) {
    return undefined;
  }
  const parsed = JSON.parse(workspaceEvent.content);
  const workspaces = List<ID>(parsed.w);
  const activeWorkspace = parsed.a;
  console.log(">> ws event", workspaceEvent.content);
  return {
    workspaces,
    activeWorkspace,
  };
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
