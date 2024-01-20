import React from "react";
import { Droppable } from "react-beautiful-dnd";
import { useMediaQuery } from "react-responsive";
import { AddColumn } from "./AddNode";
import { useKnowledgeData, useUpdateKnowledge } from "../KnowledgeDataContext";
import { FileDropZone } from "./FileDropZone";
import { Column } from "./Column";
import { IS_MOBILE } from "./responsive";
import { WorkspaceColumn } from "./Ui";
import { bulkAddRelations } from "../connections";
import { updateNode, useViewPath, useViewKey, useNode } from "../ViewContext";

/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable react/no-array-index-key */
export function WorkspaceColumnView(): JSX.Element | null {
  const isMobile = useMediaQuery(IS_MOBILE);
  const view = useNode()[1];
  if (!view) {
    return null;
  }
  return (
    <WorkspaceColumn columnSpan={isMobile ? 1 : view.width} dataTestId="ws-col">
      <Column />
    </WorkspaceColumn>
  );
}

export function EmptyColumn(): JSX.Element {
  const viewContext = useViewPath();
  const onDropFiles = (topNodes: Array<string>, nodes: Repos): void => {
    /*
    upsertRepos(
      updateNode(repos.merge(nodes), views, viewContext, (node, ctx) =>
        bulkAddRelations(node, topNodes, ctx.view.relationType)
      )
    );
     */
  };
  return (
    <WorkspaceColumn>
      <Droppable droppableId={`new:${useViewKey()}`} key="new">
        {(provided, snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={`${snapshot.isDraggingOver ? "dragging-over" : ""}`}
          >
            {provided.placeholder}
            {!snapshot.isDraggingOver && (
              <div className="outer-node">
                <FileDropZone onDrop={onDropFiles}>
                  <AddColumn />
                </FileDropZone>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </WorkspaceColumn>
  );
}

/* eslint-enable react/jsx-props-no-spreading */
/* eslint-enable @typescript-eslint/unbound-method */
