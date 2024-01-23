import React from "react";
import { useDropzone } from "react-dropzone";
import MarkdownIt from "markdown-it";

import { newNode, bulkAddRelations } from "../connections";
import { newRelations } from "../ViewContext";
import { useData } from "../DataContext";

/* eslint-disable functional/immutable-data */
function convertToPlainText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent as string;
}
/* eslint-enable functional/immutable-data */

function createSourceFromParagraphs(
  paragraphs: Array<string>,
  myself: PublicKey
): {
  nodes: KnowNode[];
  relations: Relations;
  topNodeID: LongID;
} {
  const topParagraph = paragraphs[0];
  const furtherParagraphs = paragraphs.slice(1);

  const topNode = newNode(topParagraph, myself);
  const innerNodes = furtherParagraphs.map((paragraph) => {
    return newNode(paragraph, myself);
  });
  const relations = bulkAddRelations(
    newRelations(topNode.id, "", myself),
    innerNodes.map((n) => n.id)
  );
  const nodes = [topNode, ...innerNodes];
  return {
    nodes,
    topNodeID: topNode.id,
    relations,
  };
}

type FileDropZoneProps = {
  children: React.ReactNode;
  onDrop: (
    nodes: KnowNode[],
    relations: Relations[],
    topNodes: Array<LongID>
  ) => void;
};

type MarkdownReducer = {
  nodes: KnowNode[];
  topNodeIDs: LongID[];
  relations: Relations[];
};

/* eslint-disable react/jsx-props-no-spreading */
export function FileDropZone({
  children,
  onDrop,
}: FileDropZoneProps): JSX.Element {
  const { user } = useData();
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
          const { nodes, relations, topNodeID } = createSourceFromParagraphs(
            paragraphs.map((paragraph: string) => {
              const md = new MarkdownIt();
              return convertToPlainText(md.render(paragraph));
            }),
            user.publicKey
          );
          return {
            nodes: [...rdx.nodes, ...nodes],
            topNodeIDs: [...rdx.topNodeIDs, topNodeID],
            relations: [...rdx.relations, relations],
          };
        },
        {
          nodes: [],
          topNodeIDs: [],
          relations: [],
        }
      );
      onDrop(mdNodes.nodes, mdNodes.relations, mdNodes.topNodeIDs);
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
