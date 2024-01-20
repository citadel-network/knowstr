import React from "react";
import { List } from "immutable";

import { EmptyColumn, WorkspaceColumnView } from "./WorkspaceColumn";

import { TemporaryViewProvider } from "./TemporaryViewContext";

import { getRelations } from "../connections";
import { PushViewIndex, useNode } from "../ViewContext";
import { DND } from "../dnd";
import { useData } from "../DataContext";

export function WorkspaceView(): JSX.Element | null {
  const [workspace, view] = useNode();
  const { knowledgeDBs, user } = useData();
  if (!workspace) {
    return null;
  }

  /* eslint-disable react/no-array-index-key */
  const columns = getRelations(knowledgeDBs, view.relations, user.publicKey);
  return (
    <TemporaryViewProvider>
      <div className="position-relative asset-workspace-height">
        <div className="position-absolute board overflow-y-hidden">
          <div className="workspace-columns overflow-y-hidden h-100" />
        </div>
      </div>
    </TemporaryViewProvider>
  );
  /* eslint-enable react/no-array-index-key */
}

/*
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
            */
