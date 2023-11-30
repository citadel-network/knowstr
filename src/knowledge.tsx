import { v4 } from "uuid";
import { Map, Set } from "immutable";
import { hashContent } from "./encryption";
import { relationsMapToJSON } from "./serializer";

export const DEFAULT_BRANCH_NAME = "main";

function createCommitHash(node: KnowNode, parents: Set<Hash>): Hash {
  return hashContent(
    `${node.text}${node.nodeType}${JSON.stringify(
      // pass empty string, there is no need to rewrite origin
      relationsMapToJSON(node.relations)
    )}${JSON.stringify(parents.sort().toJSON())}`
  ).substring(0, 10); // 40 Bits should be enough to be collision free
}

export function branchPathToString(
  branchPath: BranchPath | [string | undefined, string]
): string {
  const [origin, name] = branchPath;
  const originStr = origin ? `${origin}/` : "";
  return `${originStr}${name}`;
}

export function getBranch(
  repo: Repo,
  branchPath: BranchPath | string
): Branch | undefined {
  const bp: BranchPath =
    typeof branchPath === "string" ? [undefined, branchPath] : branchPath;
  const [origin, name] = bp;
  if (origin === undefined) {
    return repo.branches.get(name);
  }
  return repo.remotes.get(origin, Map<string, BranchWithCommits>()).get(name);
}

export function addToBranch(
  repo: Repo,
  node: KnowNode,
  branchName: string
): Repo {
  const branch = getBranch(repo, [undefined, branchName]);
  if (!branch) {
    throw new Error(`Branch '${branchName}' does not exist`);
  }
  return {
    ...repo,
    branches: repo.branches.set(branchName, {
      ...branch,
      staged: node,
    }),
  };
}

function hasUncommittedChanges(branch: Branch): branch is BranchWithStaged {
  return branch.staged !== undefined;
}

export function hasCommits(branch: Branch): branch is BranchWithCommits {
  return branch.head !== undefined;
}

export function getCommitHashFromBranchPath(
  repo: Repo,
  branchPath: BranchPath
): Hash | undefined {
  const branch = getBranch(repo, branchPath);
  if (!branch) {
    return undefined;
  }
  return branch.head;
}

export function getCommitHash(
  repo: Repo,
  branchOrCommit: string | BranchPath
): Hash {
  if (typeof branchOrCommit === "string") {
    // could be a local branch
    const branch = repo.branches.get(branchOrCommit);
    if (branch && hasCommits(branch)) {
      return branch.head;
    }
    // In case it's a commit hash itself;
    if (repo.commits.has(branchOrCommit)) {
      return branchOrCommit;
    }
  } else {
    const commitHash = getCommitHashFromBranchPath(repo, branchOrCommit);
    if (commitHash) {
      return commitHash;
    }
    throw new Error(
      `Commit for ${branchPathToString(branchOrCommit)} not found`
    );
  }
  throw new Error(`Commit for ${branchOrCommit} not found`);
}

function commitStaged<T extends Repo>(
  repo: T,
  branch: Branch,
  branchID: string
): [T, Hash] {
  if (!hasUncommittedChanges(branch)) {
    return [
      {
        ...repo,
        branches: repo.branches.set(branchID, branch),
      },
      branch.head,
    ];
  }

  const parents = Set<Hash>(
    branch.head
      ? [hasCommits(branch) ? getCommitHash(repo, branch.head) : branch.head]
      : []
  );
  const commit = {
    hash: createCommitHash(branch.staged, parents),
    parents,
    date: new Date(),
  };
  const updatedBranch = {
    ...branch,
    staged: undefined,
    head: commit.hash,
  };
  return [
    {
      ...repo,
      branches: repo.branches.set(branchID, updatedBranch),
      commits: repo.commits.set(commit.hash, commit),
      objects: repo.objects.set(commit.hash, branch.staged),
    },
    commit.hash,
  ];
}

export function commitAllBranches(repo: Repo): RepoWithCommits {
  return repo.branches.reduce(
    (rdx: RepoWithCommits, branch, id) => commitStaged(rdx, branch, id)[0],
    {
      ...repo,
      branches: Map<string, BranchWithCommits>(),
    }
  );
}

export function newRepo(
  node: KnowNode,
  id?: string,
  origin?: BranchPath
): Repo {
  return {
    id: id || v4(),
    commits: Map<string, Commit>(),
    objects: Map<string, KnowNode>(),
    branches: origin
      ? Map<Branch>({
          [DEFAULT_BRANCH_NAME]: {
            origin,
            staged: node,
          },
        })
      : Map<Branch>({
          [DEFAULT_BRANCH_NAME]: {
            staged: node,
          },
        }),
    remotes: Map<PublicKey, Map<string, BranchWithCommits>>(),
  };
}

function getNodeFromCommit(repo: Repo, branchOrCommit: string): KnowNode {
  const hash = getCommitHash(repo, branchOrCommit);
  const obj = repo.objects.get(hash);
  if (!obj) {
    throw new Error("Node not found");
  }
  return obj;
}

export function isBranchEqual(
  a: BranchPath | undefined,
  b: BranchPath
): boolean {
  if (a === undefined) {
    return false;
  }
  return a[0] === b[0] && a[1] === b[1];
}

export function getDefaultBranch(repo: Repo): BranchPath | undefined {
  // Check if there is a branch named DEFAULT_BRANCH_NAME in the local branches
  const defaultBranch = repo.branches.get(DEFAULT_BRANCH_NAME);
  if (defaultBranch) {
    return [undefined, DEFAULT_BRANCH_NAME];
  }

  // If there is no DEFAULT_BRANCH_NAME branch in the local branches,
  // return the first branch in the local branches
  const first = repo.branches.keySeq().first(undefined);
  if (first !== undefined) {
    return [undefined, first];
  }

  // If there is no DEFAULT_BRANCH_NAME branch in the local branches,
  // check if there is a branch named DEFAULT_BRANCH_NAME in the remotes
  const firstRemoteKey = repo.remotes
    .filter((branches) => branches.size > 0)
    .keySeq()
    .first(undefined);
  if (firstRemoteKey) {
    const firstRemote = repo.remotes.get(
      firstRemoteKey,
      Map<string, BranchWithCommits>()
    );
    const defaultRemoteBranch = firstRemote.get(DEFAULT_BRANCH_NAME);
    if (defaultRemoteBranch) {
      return [firstRemoteKey, DEFAULT_BRANCH_NAME];
    }

    // If there is no DEFAULT_BRANCH_NAME branch in the remote branches,
    // return the first branch in the remote branches
    const firstBranch = firstRemote.keySeq().first();
    if (firstBranch) {
      return [firstRemoteKey, firstBranch];
    }
  }
  return undefined;
}

export function getNode(
  repo: Repo,
  branchPath?: BranchPath | string
): KnowNode {
  const bp = branchPath || getDefaultBranch(repo);
  if (!bp) {
    return {
      text: "Node not found. No branch available.",
      nodeType: "NOTE",
      relations: Map<RelationType, Relations>(),
    };
  }
  const branch = getBranch(repo, bp);
  if (!branch) {
    return {
      text: "Node not found. Branch not found.",
      nodeType: "NOTE",
      relations: Map<RelationType, Relations>(),
    };
  }
  if (hasUncommittedChanges(branch)) {
    return branch.staged;
  }
  return getNodeFromCommit(repo, branch.head);
}

export function newDB(): KnowledgeDataWithCommits {
  return {
    repos: Map<ID, RepoWithCommits>([]),
    activeWorkspace: "offers",
    views: Map<string, View>(),
  };
}

export function clone(repo: RemoteRepo, remote: PublicKey): RepoWithCommits {
  const remotes = Map<PublicKey, Map<string, BranchWithCommits>>({
    [remote]: repo.branches,
  });
  return {
    ...repo,
    branches: Map<string, BranchWithCommits>(),
    remotes,
  };
}

function rewriteOrigin(
  origin: BranchPath,
  remote: PublicKey,
  myself: string
): BranchPath {
  if (origin[0] === undefined) {
    return [remote, origin[1]];
  }
  if (origin[0] === myself) {
    return [undefined, origin[1]];
  }
  return origin;
}

function fetchRemote<T extends Repo | RepoWithCommits>(
  repo: T,
  remoteRepo: RemoteRepo,
  remote: PublicKey,
  myRemote: PublicKey
): T {
  const remoteBranches = remoteRepo.branches.map((remoteBranch) =>
    remoteBranch.origin
      ? {
          ...remoteBranch,
          origin: rewriteOrigin(remoteBranch.origin, remote, myRemote),
        }
      : remoteBranch
  );
  return {
    ...repo,
    remotes: repo.remotes.set(remote, remoteBranches),
    commits: remoteRepo.commits.merge(repo.commits),
    objects: remoteRepo.objects.merge(repo.objects),
  };
}

export function changesSince(
  repo: Repo,
  lookingFor: Hash,
  compareTo: Hash,
  counter: number,
  visited: Set<string>
): number | undefined {
  if (visited.has(compareTo)) {
    return undefined;
  }
  if (compareTo === lookingFor) {
    return counter;
  }
  const c = repo.commits.get(compareTo);
  if (!c) {
    return undefined;
  }
  return c.parents.reduce(
    (rdx: undefined | number, parent: string): undefined | number => {
      if (rdx !== undefined) {
        return rdx;
      }
      return changesSince(
        repo,
        lookingFor,
        parent,
        counter + 1,
        visited.add(compareTo)
      );
    },
    undefined
  );
}

function isFF(repo: Repo, commitA: Hash, commitB: Hash): boolean {
  return changesSince(repo, commitB, commitA, 0, Set<string>()) !== undefined;
}

function findNewBranchName(
  repo: Repo,
  baseBranchName: string,
  counter = 0
): string {
  const branchNames = Array.from(repo.branches.keys());
  const newBranchName =
    counter === 0 ? baseBranchName : `${baseBranchName}-${counter}`;

  if (branchNames.find((name) => name === newBranchName)) {
    return findNewBranchName(repo, baseBranchName, counter + 1);
  }
  return newBranchName;
}

function branchNameForCheckout(repo: Repo, branchPath: BranchPath): string {
  if (!repo.branches.has(DEFAULT_BRANCH_NAME)) {
    return DEFAULT_BRANCH_NAME;
  }
  // Take over origins branch name if still available
  return repo.branches.has(branchPath[1])
    ? findNewBranchName(
        repo,
        `${branchPath[0] ? `${branchPath[0].substr(0, 10)}-` : ""}${
          branchPath[1]
        }`
      )
    : branchPath[1];
}

export function checkoutRemoteBranch(
  repo: Repo,
  branchPath: BranchPath
): [Repo, BranchPath] {
  const remoteBranch = getBranch(repo, branchPath);
  if (!remoteBranch) {
    throw new Error(`Couldn't find branch '${branchPathToString(branchPath)}'`);
  }
  const localBranch = {
    ...remoteBranch,
    origin: branchPath,
  };
  const name = branchNameForCheckout(repo, branchPath);
  const updatedRepo = {
    ...repo,
    branches: repo.branches.set(name, localBranch),
  };
  return [updatedRepo, [undefined, name]];
}

export function ensureLocalBranch(
  repo: Repo,
  path: BranchPath
): [Repo, BranchPath] {
  // If the given branch is not a remote, just return it
  if (path[0] === undefined) {
    return [repo, path];
  }
  // Do I already have a branch which is FF to this?
  const sameHead = repo.branches
    .filter(
      (branch) =>
        branch.head &&
        getCommitHash(repo, path) === branch.head &&
        !branch.staged
    )
    .entrySeq()
    .first(undefined);
  if (sameHead) {
    return [repo, [undefined, sameHead[0]]];
  }
  // Is this branch tracking my branch and is it ff?
  return checkoutRemoteBranch(repo, path);
}

export function mergeIntoDefault(
  repo: Repo,
  toAccept: BranchPath
): [Repo, BranchPath] {
  const baseBranch = getBranch(repo, DEFAULT_BRANCH_NAME);
  if (!baseBranch) {
    return checkoutRemoteBranch(repo, toAccept);
  }
  const acceptBranch = getBranch(repo, toAccept);
  if (!acceptBranch || !acceptBranch.head) {
    throw new Error("branch does not exist or doesn't have any commits");
  }
  if (
    baseBranch.head &&
    (isFF(repo, acceptBranch.head, baseBranch.head) ||
      // In this case we might want to backup current baseBranch
      isFF(repo, baseBranch.head, acceptBranch.head))
  ) {
    const updatedBranch = {
      ...baseBranch,
      head: acceptBranch.head,
      origin: toAccept[0] === undefined ? baseBranch.origin : toAccept,
      staged: acceptBranch.staged,
    };
    return [
      {
        ...repo,
        branches: repo.branches.set(DEFAULT_BRANCH_NAME, updatedBranch),
      },
      [undefined, DEFAULT_BRANCH_NAME],
    ];
  }

  const hash = acceptBranch.head;
  const node = acceptBranch.staged
    ? acceptBranch.staged
    : getNodeFromCommit(repo, hash);

  const parents = Set<Hash>(baseBranch.head ? [baseBranch.head, hash] : [hash]);
  const mergeCommit = {
    hash: createCommitHash(node, parents),
    parents,
    date: new Date(),
  };
  const updatedBaseBranch = {
    ...baseBranch,
    staged: undefined,
    head: mergeCommit.hash,
    origin: toAccept[0] === undefined ? baseBranch.origin : toAccept,
  };
  const branches =
    toAccept[0] === undefined && toAccept[1] !== DEFAULT_BRANCH_NAME
      ? repo.branches.remove(toAccept[1])
      : repo.branches;
  const updatedRepo = {
    ...repo,
    branches: branches.set(DEFAULT_BRANCH_NAME, updatedBaseBranch),
    commits: repo.commits.set(mergeCommit.hash, mergeCommit),
    objects: repo.objects.set(mergeCommit.hash, node),
  };
  return [updatedRepo, [undefined, DEFAULT_BRANCH_NAME]];
}

export function pull(
  r: RepoWithCommits,
  remoteRepo: RepoWithCommits,
  remote: PublicKey,
  myRemote: PublicKey
): RepoWithCommits {
  const repo = fetchRemote(r, remoteRepo, remote, myRemote);
  return repo.branches.reduce((rdx, branch, identifier): RepoWithCommits => {
    if (branch.origin && branch.origin[0] === remote && hasCommits(branch)) {
      const remoteBranch = repo.remotes
        .get(remote, Map<string, BranchWithCommits>())
        .get(branch.origin[1]);
      if (!remoteBranch) {
        return rdx;
      }
      if (isFF(repo, remoteBranch.head, branch.head)) {
        const updatedBranch = {
          ...branch,
          head: remoteBranch.head,
        };
        return {
          ...rdx,
          branches: rdx.branches.set(identifier, updatedBranch),
        };
      }
      return rdx;
    }
    return rdx;
  }, repo);
}

export const NO_CHANGES = "No Changes";

export function describeDiff(
  repo: Repo,
  a: string | BranchPath,
  b: string | BranchPath,
  includeUncommitted = false
): string {
  const commitA = getCommitHash(repo, a);
  const commitB = getCommitHash(repo, b);
  const branchA = getBranch(repo, a);
  const branchB = getBranch(repo, b);
  const aToB = changesSince(repo, commitA, commitB, 0, Set<string>());
  const bToA = changesSince(repo, commitB, commitA, 0, Set<string>());
  if (aToB === undefined && bToA === undefined) {
    return "Version differs";
  }

  const stagedA =
    includeUncommitted && branchA && branchA.staged !== undefined ? -1 : 0;
  const stagedB =
    includeUncommitted && branchB && branchB.staged !== undefined ? 1 : 0;
  const diffCount = (aToB || 0) - (bToA || 0) + stagedB + stagedA;
  if (diffCount > 0) {
    return `${diffCount} changes ahead`;
  }
  if (diffCount < 0) {
    return `${-diffCount} changes behind`;
  }
  return NO_CHANGES;
}
