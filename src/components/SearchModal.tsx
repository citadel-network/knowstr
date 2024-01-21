import React, { KeyboardEvent, useEffect, useRef, useState } from "react";
import { Map } from "immutable";
import { ModalNode, ModalNodeBody, ModalNodeTitle } from "./Ui";
import { useData } from "../DataContext";
import { newDB } from "../knowledge";

const KEY_DOWN = 40;
const KEY_UP = 38;
const ENTER = 13;
export const ESC = 27;

function isMatch(input: string, test: string): boolean {
  const searchStr = input.toLowerCase().replace(/\n/g, "");
  const str = test.toLowerCase().replace(/\n/g, "");
  return str.indexOf(searchStr) !== -1;
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
  onAddExistingNode: (id: LongID) => void;
  onHide: () => void;
};

function Search({
  onAddExistingNode,
  onHide,
  nodes,
}: SearchModalProps & {
  nodes: Nodes;
}): JSX.Element {
  const [filter, setFilter] = useState<string>("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<number>(0);
  const ref = React.createRef<HTMLInputElement>();
  const searchResultRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions =
    filter === ""
      ? Map<string, KnowNode>()
      : nodes
          .filter((node) => {
            return isMatch(filter, node.text);
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
              onAddExistingNode(
                (filteredSuggestions.toList().get(suggestionIndex) as KnowNode)
                  .id
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
          {filteredSuggestions.toList().map((node, i) => {
            return (
              <div
                key={node.id}
                ref={i === suggestionIndex ? searchResultRef : undefined}
                className={`${
                  i === suggestionIndex ? "active" : ""
                } dropdown-item w-100 search-dropdown`}
                role="button"
                onClick={() => {
                  onAddExistingNode(node.id);
                  onHide();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onAddExistingNode(node.id);
                    onHide();
                  }
                }}
                tabIndex={0}
                aria-label={`select ${node.text}`}
              >
                {" "}
                <div className="white-space-normal">
                  <HighlightedText nodeText={node.text} searchInput={filter} />
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
  onAddExistingNode,
  onHide,
}: SearchModalProps): JSX.Element | null {
  const { knowledgeDBs, user } = useData();
  const myDB = knowledgeDBs.get(user.publicKey, newDB());

  // TODO: right now we don't find other versions of the same node written by other users in the search
  const nodes = knowledgeDBs
    .filter((_, publicKey) => publicKey !== user.publicKey)
    .reduce((acc, db) => acc.merge(db.nodes), Map<ID, KnowNode>())
    .merge(myDB.nodes);

  return (
    <Search
      onAddExistingNode={onAddExistingNode}
      onHide={onHide}
      nodes={nodes}
    />
  );
}
