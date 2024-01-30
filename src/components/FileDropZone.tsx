import React from "react";
import { useDropzone } from "react-dropzone";
import MarkdownIt from "markdown-it";

import { v4 } from "uuid";
import { Map } from "immutable";
import { Event } from "nostr-tools";
import {
  finalizeEvent,
  KIND_KNOWLEDGE_NODE_COLLECTION,
  newTimestamp,
} from "../nostr";
import { newNode, bulkAddRelations, shortID } from "../connections";
import { newRelations } from "../ViewContext";
import { Plan, planUpsertRelations, usePlanner } from "../planner";
import { newDB } from "../knowledge";

/* eslint-disable functional/immutable-data */
function convertToPlainText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent as string;
}
/* eslint-enable functional/immutable-data */

function createRelationsFromParagraphNodes(
  nodes: KnowNode[],
  myself: PublicKey
): [relations: Relations, topNodeID: LongID] {
  const topParagraph = nodes[0];
  const furtherParagraphs = nodes.slice(1);
  const relations = bulkAddRelations(
    newRelations(topParagraph.id, "", myself),
    furtherParagraphs.map((n) => n.id)
  );
  return [relations, topParagraph.id];
}

export function createNodesFromMarkdown(
  markdown: string,
  baseID: string,
  myself: PublicKey
): KnowNode[] {
  const markdownParagraphs = markdown.split("\n\n");
  const plainTextParagraphs = markdownParagraphs.map((paragraph: string) => {
    const md = new MarkdownIt();
    return convertToPlainText(md.render(paragraph));
  });
  return plainTextParagraphs.map((paragraph, index) => {
    return newNode(paragraph, myself, `${baseID}${index}`);
  });
}

const CHUNK_SIZE = 8196;

function splitMarkdownInChunkSizes(markdown: string): string[] {
  const paragraphs = markdown.split("\n\n");
  return paragraphs.reduce((rdx: string[], p: string, i: number): string[] => {
    const currentChunk = rdx[rdx.length - 1] || "";

    const paragraph = i === paragraphs.length - 1 ? p : `${p}\n\n`;
    if (currentChunk.length + paragraph.length > CHUNK_SIZE) {
      return [...rdx, paragraph];
    }
    return [...rdx.slice(0, -1), `${currentChunk}${paragraph}`];
  }, []);
}

export function planCreateNodesFromMarkdown(
  plan: Plan,
  markdown: string
): [Plan, topNodeID: LongID] {
  const splittedMarkdown = splitMarkdownInChunkSizes(markdown);
  const { events, nodes } = splittedMarkdown.reduce(
    (rdx: { events: Event[]; nodes: KnowNode[] }, md: string) => {
      const baseID = v4();
      const mdNodes = createNodesFromMarkdown(md, baseID, plan.user.publicKey);
      const publishNodeEvent = finalizeEvent(
        {
          kind: KIND_KNOWLEDGE_NODE_COLLECTION,
          pubkey: plan.user.publicKey,
          created_at: newTimestamp(),
          tags: [["d", baseID]],
          content: md,
        },
        plan.user.privateKey
      );
      return {
        events: [...rdx.events, publishNodeEvent],
        nodes: [...rdx.nodes, ...mdNodes],
      };
    },
    { events: [], nodes: [] }
  );
  const [relations, topNodeID] = createRelationsFromParagraphNodes(
    nodes,
    plan.user.publicKey
  );
  const planWithRelations = planUpsertRelations(plan, relations);
  const userDB = planWithRelations.knowledgeDBs.get(
    plan.user.publicKey,
    newDB()
  );
  const updatedNodes = userDB.nodes.merge(
    Map(nodes.map((node) => [shortID(node.id), node]))
  );
  const updatedDB = {
    ...userDB,
    nodes: updatedNodes,
  };

  const finalPlan = {
    ...planWithRelations,
    knowledgeDBs: planWithRelations.knowledgeDBs.set(
      plan.user.publicKey,
      updatedDB
    ),
    publishEvents: planWithRelations.publishEvents.push(...events),
  };
  return [finalPlan, topNodeID];
}

type FileDropZoneProps = {
  children: React.ReactNode;
  onDrop: (plan: Plan, topNodes: Array<LongID>) => void;
};

type MarkdownReducer = {
  plan: Plan;
  topNodeIDs: LongID[];
};

/* eslint-disable react/jsx-props-no-spreading */
export function FileDropZone({
  children,
  onDrop,
}: FileDropZoneProps): JSX.Element {
  const { createPlan } = usePlanner();
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
          const [plan, topNodeID] = planCreateNodesFromMarkdown(
            rdx.plan,
            markdown
          );
          return {
            plan,
            topNodeIDs: [...rdx.topNodeIDs, topNodeID],
          };
        },
        {
          plan: createPlan(),
          topNodeIDs: [],
        }
      );
      onDrop(mdNodes.plan, mdNodes.topNodeIDs);
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
