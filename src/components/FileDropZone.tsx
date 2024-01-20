import React from "react";
import { useDropzone } from "react-dropzone";
import MarkdownIt from "markdown-it";
import Immutable from "immutable";

import { newNode, addRelationToRelations } from "../connections";
import {
  addToBranch,
  DEFAULT_BRANCH_NAME,
  getNode,
  newRepo,
} from "../knowledge";

/* eslint-disable functional/immutable-data */
function convertToPlainText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent as string;
}
/* eslint-enable functional/immutable-data */

function createSourceFromParagraphs(paragraphs: Array<string>): {
  repos: Repos;
  topRepoID: string;
} {
  const topParagraph = paragraphs[0];
  const furtherParagraphs = paragraphs.slice(1);

  const source = newRepo(newNode(topParagraph, "TITLE"));
  const repos = furtherParagraphs.reduce((r, paragraph) => {
    const quote = newRepo(newNode(paragraph, "QUOTE"));
    const s = r.get(source.id) as Repo;
    return r
      .set(quote.id, quote)
      .set(
        source.id,
        addToBranch(
          s,
          addRelationToRelations(getNode(s), quote.id, "CONTAINS"),
          DEFAULT_BRANCH_NAME
        )
      );
  }, Immutable.Map<string, Repo>().set(source.id, source));
  return {
    repos,
    topRepoID: source.id,
  };
}

type FileDropZoneProps = {
  children: React.ReactNode;
  onDrop: (topNodes: Array<string>, nodes: Repos) => void;
};

type MarkdownReducer = {
  repos: Repos;
  topNodeIDs: Array<string>;
};

/* eslint-disable react/jsx-props-no-spreading */
export function FileDropZone({
  children,
  onDrop,
}: FileDropZoneProps): JSX.Element {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    noClick: true,
    noKeyboard: true,
    accept: ".md",
    onDrop: async (acceptedFiles: Array<File>) => {
      const markdowns = await Promise.all(
        acceptedFiles.map((file: File): Promise<string> => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            /* eslint-disable functional/immutable-data */
            reader.onload = () => {
              resolve(reader.result as string);
            };
            reader.onerror = reject;
            reader.readAsText(file);
            /* eslint-enable functional/immutable-data */
          });
        })
      );
      const mdNodes = markdowns.reduce(
        (rdx: MarkdownReducer, markdown: string) => {
          const paragraphs = markdown.split("\n\n");
          const { repos, topRepoID } = createSourceFromParagraphs(
            paragraphs.map((paragraph: string) => {
              const md = new MarkdownIt();
              return convertToPlainText(md.render(paragraph));
            })
          );
          return {
            repos: rdx.repos.merge(repos),
            topNodeIDs: [...rdx.topNodeIDs, topRepoID],
          };
        },
        {
          repos: Immutable.Map<string, Repo>(),
          topNodeIDs: [],
        }
      );
      onDrop(mdNodes.topNodeIDs, mdNodes.repos);
    },
  });
  const className = isDragActive ? "dimmed flex-col-100" : "flex-col-100";
  return (
    <div {...getRootProps({ className })}>
      {children}
      <input {...getInputProps()} />
    </div>
  );
}
/* eslint-enable react/jsx-props-no-spreading */
