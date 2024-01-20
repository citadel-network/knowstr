import React, { KeyboardEvent, useEffect, useRef, useState } from "react";
import { Map } from "immutable";
import { useGetNodeText, useKnowledgeData } from "../KnowledgeDataContext";
import { ModalNode, ModalNodeBody, ModalNodeTitle } from "./Ui";
import { getRelations, getSubjects } from "../connections";
import { useNode } from "../ViewContext";

const KEY_DOWN = 40;
const KEY_UP = 38;
const ENTER = 13;
export const ESC = 27;

function isMatch(input: string, test: string): boolean {
  const searchStr = input.toLowerCase().replace(/\n/g, "");
  const str = test.toLowerCase().replace(/\n/g, "");
  return str.indexOf(searchStr) !== -1;
}

function getSummaryText(
  repo: Repo,
  repos: Repos,
  getNodeText: (node: KnowNode) => string,
  branch?: BranchPath
): string | undefined {
  const node = getNode(repo, branch);
  const summaryRelations = getRelations(node, "SUMMARY");
  const summaryId = summaryRelations.first()?.id || undefined;
  if (!summaryId) {
    return undefined;
  }
  const summaryRepo = repos.get(summaryId);
  if (!summaryRepo) {
    return undefined;
  }
  const summaryDefaultBranch = getDefaultBranch(summaryRepo);
  return getNodeText(getNode(summaryRepo, summaryDefaultBranch));
}

function useGetSummaryTextsForRepos(): Map<string, string | undefined> {
  const getNodeText = useGetNodeText();
  const view = useNode()[1];
  const { repos } = useKnowledgeData();
  return repos
    .map((repo) => getSummaryText(repo, repos, getNodeText, view?.branch))
    .filter((text) => text !== undefined);
}

function getSourcesForQuotes(
  repo: Repo,
  repos: Repos,
  getNodeText: (node: KnowNode) => string,
  branch?: BranchPath
): string | undefined {
  const { nodeType } = getNode(repo, branch);
  if (nodeType !== "QUOTE") {
    return undefined;
  }
  const subjects = getSubjects(repos, repo.id, ["TITLE", "URL"]);
  const sourceRepo = subjects.first();
  if (!sourceRepo) {
    return undefined;
  }
  const sourceDefaultBranch = getDefaultBranch(sourceRepo);
  return getNodeText(getNode(sourceRepo, sourceDefaultBranch));
}

function filterSuggestions(suggestions: Repos): Repos {
  const idsOfSummaries = suggestions.reduce(
    (rdx: Array<string>, repo: Repo) => {
      const summaries = getRelations(getNode(repo), "SUMMARY");
      return summaries
        ? summaries.reduce((red: Array<string>, sum: Relation) => {
            return red.concat([sum.id]);
          }, rdx)
        : rdx;
    },
    []
  );
  return suggestions.filter((repo) => !idsOfSummaries.includes(repo.id));
}

function HighlightedText({
  nodeText,
  searchInput,
}: {
  nodeText: string;
  searchInput: string;
}): JSX.Element {
  // don't highlight too much
  if (searchInput.length < 3) {
    return <div>{nodeText}</div>;
  }
  const highlightedText = nodeText.replace(
    new RegExp(searchInput, "gi"),
    (match) =>
      `<span style="background-color: rgba(0, 0, 0, 0.3);">${match}</span>`
  );
  return (
    // eslint-disable-next-line react/no-danger
    <div dangerouslySetInnerHTML={{ __html: highlightedText }} />
  );
}

type SearchModalProps = {
  onAddExistingRepo: (repo: Repo) => void;
  onHide: () => void;
};

function Search({
  onAddExistingRepo,
  onHide,
  repos,
  summaryTextMap,
}: SearchModalProps & {
  repos: Repos;
  summaryTextMap: Map<string, string | undefined>;
}): JSX.Element {
  const [filter, setFilter] = useState<string>("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<number>(0);
  const getNodeText = useGetNodeText();
  const ref = React.createRef<HTMLInputElement>();
  const searchResultRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions =
    filter === ""
      ? Map<string, Repo>()
      : repos
          .filter((r) => {
            const summaryText = summaryTextMap.get(r.id);
            const matchingText = summaryText
              ? `${summaryText} ${getNodeText(getNode(r))}`
              : getNodeText(getNode(r));
            return isMatch(filter, matchingText);
          })
          .slice(0, 25);

  const suggestionIndex = Math.min(
    selectedSuggestion,
    filteredSuggestions.size - 1
  );

  useEffect(() => {
    (ref.current as HTMLInputElement).focus();
  });

  useEffect(() => {
    if (searchResultRef.current && searchResultRef.current.scrollIntoView) {
      searchResultRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedSuggestion, filter]);

  return (
    <ModalNode onHide={onHide}>
      <ModalNodeTitle>
        <input
          className="text-large w-100 search-input"
          aria-label="search input"
          style={{ borderWidth: "0px" }}
          type="text"
          placeholder="Search"
          ref={ref}
          onChange={(e) => {
            const text = e.target.value;
            if (text === "\n") {
              setSelectedSuggestion(0);
            }
            setFilter(text);
          }}
          onFocus={() => setSelectedSuggestion(0)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.keyCode === KEY_UP && filteredSuggestions.size > 0) {
              e.preventDefault();
              setSelectedSuggestion(Math.max(suggestionIndex - 1, -1));
            }
            if (e.keyCode === KEY_DOWN && filteredSuggestions.size > 0) {
              e.preventDefault();
              setSelectedSuggestion(
                Math.min(suggestionIndex + 1, filteredSuggestions.size - 1)
              );
            }
            if (e.keyCode === ENTER && suggestionIndex >= 0) {
              e.preventDefault();
              onAddExistingRepo(
                filteredSuggestions.toList().get(suggestionIndex) as Repo
              );
              onHide();
            }
            if (e.keyCode === ESC) {
              e.preventDefault();
              if (suggestionIndex >= 0) {
                setSelectedSuggestion(-1);
              } else {
                onHide();
              }
            }
          }}
        />
      </ModalNodeTitle>
      {suggestionIndex >= 0 && (
        <ModalNodeBody>
          <div className="border-top-strong mb-2" />
          {filteredSuggestions.toList().map((r, i) => {
            const summaryText = summaryTextMap?.get(r.id);
            const sourceText = getSourcesForQuotes(r, repos, getNodeText);
            return (
              <div
                key={r.id}
                ref={i === suggestionIndex ? searchResultRef : undefined}
                className={`${
                  i === suggestionIndex ? "active" : ""
                } dropdown-item w-100 search-dropdown`}
                role="button"
                onClick={() => {
                  onAddExistingRepo(r);
                  onHide();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onAddExistingRepo(r);
                    onHide();
                  }
                }}
                tabIndex={0}
                aria-label={`select ${getNodeText(getNode(r))}`}
              >
                {" "}
                <div className="white-space-normal">
                  {summaryText && (
                    <>
                      <span className="iconsminds-filter-2 me-2" />
                      <span className="font-italic">{summaryText}</span>
                    </>
                  )}
                  <HighlightedText
                    nodeText={getNodeText(getNode(r))}
                    searchInput={filter}
                  />
                  {sourceText && (
                    <div className="text-right">
                      <span className="font-italic pt-1">{sourceText}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </ModalNodeBody>
      )}
    </ModalNode>
  );
}

export function SearchModal({
  onAddExistingRepo,
  onHide,
}: SearchModalProps): JSX.Element | null {
  const { repos } = useKnowledgeData();
  const summaryTextMap = useGetSummaryTextsForRepos();
  const sortedSuggestions: SortedRepos = repos.sortBy((repo) =>
    getNode(repo).nodeType === "TOPIC" ? 0 : 1
  );

  const suggestionsWithoutSummaries = filterSuggestions(sortedSuggestions);
  return (
    <Search
      onAddExistingRepo={onAddExistingRepo}
      onHide={onHide}
      repos={suggestionsWithoutSummaries}
      summaryTextMap={summaryTextMap}
    />
  );
}
