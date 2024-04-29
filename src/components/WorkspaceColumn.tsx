import React from "react";
import { useMediaQuery } from "react-responsive";
import { WorkspaceColumn } from "citadel-commons";
import { AddColumn } from "./AddNode";
import { FileDropZone } from "./FileDropZone";
import { Column } from "./Column";
import { IS_MOBILE } from "./responsive";
import { addRelationToRelations } from "../connections";
import { useViewPath, useNode, upsertRelations } from "../ViewContext";
import { Plan, usePlanner } from "../planner";
import { DroppableContainer } from "./DroppableContainer";

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
  const { executePlan } = usePlanner();
  const onDropFiles = (plan: Plan, topNodes: Array<LongID>): void => {
    const addTopNodesPlan = upsertRelations(plan, viewContext, (r: Relations) =>
      addRelationToRelations(r, topNodes[0])
    );
    executePlan(addTopNodesPlan);
  };
  return (
    <DroppableContainer>
      <FileDropZone onDrop={onDropFiles}>
        <WorkspaceColumn>
          <div>
            <div className="outer-node">
              <AddColumn />
            </div>
          </div>
        </WorkspaceColumn>
      </FileDropZone>
    </DroppableContainer>
  );
}
