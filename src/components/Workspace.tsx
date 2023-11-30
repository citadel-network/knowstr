import React from "react";
import { List } from "immutable";

import { EmptyColumn, WorkspaceColumnView } from "./WorkspaceColumn";

import { TemporaryViewProvider } from "./TemporaryViewContext";

import { getRelations } from "../connections";
import { getNode } from "../knowledge";
import { PushViewIndex, useRepo } from "../ViewContext";
import { DND } from "../dnd";

export function WorkspaceView(): JSX.Element | null {
  const [workspace, view] = useRepo();
  if (!workspace) {
    return null;
  }

  const workspaceNode = getNode(workspace, view.branch);

  /* eslint-disable react/no-array-index-key */
  const columns = getRelations(workspaceNode, view.relationType);
  return (
    <TemporaryViewProvider>
      <div className="position-relative asset-workspace-height">
        <div className="position-absolute board overflow-y-hidden">
          <div className="workspace-columns overflow-y-hidden h-100">
            <DND>
              {columns.map((column, index) => {
                return (
                  <PushViewIndex push={List([index])} key={index}>
                    <WorkspaceColumnView />
                  </PushViewIndex>
                );
              })}
              <EmptyColumn />
            </DND>
          </div>
        </div>
      </div>
    </TemporaryViewProvider>
  );
  /* eslint-enable react/no-array-index-key */
}
