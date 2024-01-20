import React from "react";
import { Map, Set } from "immutable";
import { Dropdown } from "react-bootstrap";
import {
  useGetNodeText,
  useKnowledgeData,
  useUpdateKnowledge,
} from "../KnowledgeDataContext";
import {
  deleteChildViews,
  getNodeFromView,
  updateView,
  useViewKey,
  useViewPath,
} from "../ViewContext";
import { useDeselectAllInView } from "./TemporaryViewContext";

function shortenBranchPath(
  branchPath: BranchPath
): [string | undefined, string] {
  return [
    branchPath[0] ? branchPath[0].substring(0, 8) : undefined,
    branchPath[1],
  ];
}

function AcceptVersion(): JSX.Element | null {
  const upsertRepos = useUpdateKnowledge();
  const viewContext = useViewPath();
  const { views, repos } = useKnowledgeData();
  const [repo, view] = getNodeFromView(repos, views, viewContext);
  if (!repo) {
    return null;
  }
  const defaultBranch = repo.branches.get(DEFAULT_BRANCH_NAME);
  const acceptBranch = getBranch(repo, view.branch);
  const getNodeText = useGetNodeText();
  if (
    isBranchEqual([undefined, DEFAULT_BRANCH_NAME], view.branch) ||
    repo.branches.size === 0 ||
    (defaultBranch !== undefined &&
      acceptBranch !== undefined &&
      defaultBranch.head === acceptBranch.head)
  ) {
    return null;
  }
  const onClick = (): void => {
    const [updatedRepo, branch] = mergeIntoDefault(repo, view.branch);
    upsertRepos({
      views: updateView(views, viewContext, {
        ...view,
        branch,
      }),
      repos: repos.set(updatedRepo.id, updatedRepo),
    });
  };
  return (
    <button
      type="button"
      className="btn btn-outline-primary"
      onClick={onClick}
      aria-label={`accept ${getNodeText(
        getNode(repo, view.branch)
      )} [${branchPathToString(view.branch)}]`}
    >
      <span className="iconsminds-yes" />
    </button>
  );
}

function DropdownItem({
  repo,
  branch,
  branchPath,
  onSelect,
  selected,
}: {
  repo: Repo;
  branch: BranchWithCommits;
  branchPath: BranchPath;
  onSelect: () => void;
  selected: BranchPath;
}): JSX.Element {
  const commit = repo.commits.get(getCommitHash(repo, branchPath));
  const diffDesc = describeDiff(repo, selected, branchPath);
  return (
    <Dropdown.Item
      onClick={onSelect}
      active={selected[0] === branchPath[0] && selected[1] === branchPath[1]}
    >
      {branchPath[0] === undefined && branchPath[1] === DEFAULT_BRANCH_NAME && (
        <div>Main</div>
      )}
      {commit && <div>Created: {commit.date.toLocaleString()}</div>}
      {diffDesc !== NO_CHANGES && <div>{diffDesc}</div>}
      {branch.origin && (
        <>
          <div>
            Remote: {branchPathToString(shortenBranchPath(branch.origin))}
          </div>
        </>
      )}
    </Dropdown.Item>
  );
}

export function isShowVersions(
  repo: Repo,
  view: View
): [boolean, Array<[string, Branch]>, Map<BranchPath, BranchWithCommits>] {
  const selectedHash = getCommitHashFromBranchPath(repo, view.branch);

  const localBranches = repo.branches.toArray();
  const unfilteredRemotes = repo.remotes.reduce(
    (rdx, branches: Map<string, BranchWithCommits>, remote) => {
      return rdx.merge(
        Map<BranchPath, BranchWithCommits>(
          branches.mapEntries(([name, branch]) => [[remote, name], branch])
        )
      );
    },
    Map<BranchPath, BranchWithCommits>()
  );
  if (localBranches.length + unfilteredRemotes.size === 1) {
    return [false, localBranches, unfilteredRemotes];
  }

  const remoteBranches = unfilteredRemotes
    .filter((_, remotePath) => {
      const remoteHash = getCommitHash(repo, remotePath);
      if (selectedHash === undefined || remoteHash === undefined) {
        return true;
      }
      return (
        changesSince(repo, remoteHash, selectedHash, 0, Set<string>()) !== 0
      );
    })
    .sort((a, b) => {
      const commitA = repo.commits.get(getCommitHash(repo, a.head));
      const commitB = repo.commits.get(getCommitHash(repo, b.head));
      if (commitA && commitB) {
        return commitA.date.getTime() < commitB.date.getTime() ? 1 : -1;
      }
      return 0;
    });
  if (
    localBranches.length + remoteBranches.size === 1 &&
    isBranchEqual([undefined, DEFAULT_BRANCH_NAME], view.branch)
  ) {
    return [false, localBranches, remoteBranches];
  }
  return [true, localBranches, remoteBranches];
}

export function SelectVersions({
  readonly,
}: {
  readonly?: boolean;
}): JSX.Element | null {
  const { views, repos } = useKnowledgeData();
  const viewPath = useViewPath();
  const viewKey = useViewKey();
  const updateKnowledge = useUpdateKnowledge();
  const deselectAllInView = useDeselectAllInView();
  const [repo, view] = getNodeFromView(repos, views, viewPath);
  if (!repo) {
    return null;
  }

  const [showVersions, localBranches, remoteBranches] = isShowVersions(
    repo,
    view
  );

  if (!showVersions) {
    return null;
  }
  if (readonly) {
    return (
      <div>
        <span className="iconsminds-clock-forward" />
      </div>
    );
  }

  const onSelectBranch = (branch: BranchPath): void => {
    updateKnowledge({
      views: updateView(deleteChildViews(views, viewPath), viewPath, {
        ...view,
        branch,
      }),
    });
    deselectAllInView(viewKey);
  };

  return (
    <>
      <Dropdown>
        <Dropdown.Toggle
          as="button"
          className="btn btn-borderless dropdown-toggle"
          aria-label="select version"
        >
          <span className="iconsminds-clock-forward" />
        </Dropdown.Toggle>
        <Dropdown.Menu popperConfig={{ strategy: "fixed" }}>
          {localBranches.map(([name, branch]) => {
            if (hasCommits(branch)) {
              return (
                <DropdownItem
                  selected={view.branch}
                  repo={repo}
                  branch={branch}
                  branchPath={[undefined, name]}
                  onSelect={() => onSelectBranch([undefined, name])}
                  key={name}
                />
              );
            }
            return null;
          })}
          {localBranches.length > 0 && remoteBranches.size > 0 && (
            <Dropdown.Divider />
          )}
          {remoteBranches.toArray().map(([path, branch]) => {
            return (
              <DropdownItem
                repo={repo}
                branch={branch}
                branchPath={path}
                onSelect={() => onSelectBranch(path)}
                key={branchPathToString(path)}
                selected={view.branch}
              />
            );
          })}
        </Dropdown.Menu>
      </Dropdown>
      <AcceptVersion />
    </>
  );
}
