import React from "react";
import { Droppable } from "@hello-pangea/dnd";
import { useMediaQuery } from "react-responsive";
import { AddColumn } from "./AddNode";
import { FileDropZone } from "./FileDropZone";
import { Column } from "./Column";
import { IS_MOBILE } from "./responsive";
import { WorkspaceColumn } from "./Ui";
import { addRelationToRelations } from "../connections";
import {
  useViewPath,
  useViewKey,
  useNode,
  upsertRelations,
} from "../ViewContext";
import {
  planBulkUpsertNodes,
  planBulkUpsertRelations,
  usePlanner,
} from "../planner";

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
  const { createPlan, executePlan } = usePlanner();
  const onDropFiles = (
    nodes: KnowNode[],
    relations: Relations[],
    topNodes: Array<LongID>
  ): void => {
    const bulkUpsertPlan = planBulkUpsertNodes(createPlan(), nodes);
    const addTopNodesPlan = upsertRelations(
      bulkUpsertPlan,
      viewContext,
      (r: Relations) => addRelationToRelations(r, topNodes[0])
    );
    const addRelationsPlan = planBulkUpsertRelations(
      addTopNodesPlan,
      relations
    );
    executePlan(addRelationsPlan);
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
