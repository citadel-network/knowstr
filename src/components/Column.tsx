import React from "react";
import { Droppable } from "@hello-pangea/dnd";
import { Card } from "react-bootstrap";
import { bulkAddRelations } from "../connections";
import { FileDropZone } from "./FileDropZone";
import { DraggableNode } from "./Node";
import { ColumnMenu } from "./Menu";
import { useDeselectAllInView } from "./TemporaryViewContext";
import { UIColumn, UIColumnBody, UIColumnHeader } from "./Ui";
import { RemoveColumnButton } from "./RemoveColumnButton";
import { upsertRelations, useViewKey, useViewPath } from "../ViewContext";
import { TreeView } from "./TreeView";
import { AddNodeToNode } from "./AddNode";
import { Plan, usePlanner } from "../planner";

/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable @typescript-eslint/unbound-method */
export function Column(): JSX.Element | null {
  const viewContext = useViewPath();
  const deselectByPostfix = useDeselectAllInView();
  const viewKey = useViewKey();
  const { executePlan } = usePlanner();
  const onDropFiles = (plan: Plan, topNodes: Array<LongID>): void => {
    const addTopNodesPlan = upsertRelations(plan, viewContext, (r: Relations) =>
      bulkAddRelations(r, topNodes)
    );
    executePlan(addTopNodesPlan);
    deselectByPostfix(viewKey);
  };

  return (
    <UIColumn>
      <FileDropZone onDrop={onDropFiles}>
        <UIColumnBody>
          <UIColumnHeader>
            <div className="position-relative">
              <div className="outer-node-extras">
                <RemoveColumnButton />
              </div>
            </div>
            <Droppable isDropDisabled droppableId={`head:${viewKey}`}>
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  <DraggableNode dndIndex={0} sticky />
                </div>
              )}
            </Droppable>
            <Card.Body className="p-0">
              <ColumnMenu />
            </Card.Body>
          </UIColumnHeader>
          <TreeView />
        </UIColumnBody>
        <Droppable droppableId={`bottom:${viewKey}`}>
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={`${snapshot.isDraggingOver ? "dragging-over" : ""}`}
            >
              {provided.placeholder}
              {!snapshot.isDraggingOver && (
                <div className="add-to-node">
                  <AddNodeToNode />
                </div>
              )}
            </div>
          )}
        </Droppable>
      </FileDropZone>
    </UIColumn>
  );
}
/* eslint-enable react/jsx-props-no-spreading */
/* eslint-enable @typescript-eslint/unbound-method */
