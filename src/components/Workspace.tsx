import React, { useRef } from "react";
import { List } from "immutable";

import { useDndScrolling } from "react-dnd-scrolling";
import { EmptyColumn, WorkspaceColumnView } from "./WorkspaceColumn";

import { TemporaryViewProvider } from "./TemporaryViewContext";

import { getRelations } from "../connections";
import { PushNode, useNodeID } from "../ViewContext";
import { DND } from "../dnd";
import { useData } from "../DataContext";

export function WorkspaceView(): JSX.Element | null {
  const [workspaceID, view] = useNodeID();
  const { knowledgeDBs, user } = useData();

  const ref = useRef<HTMLDivElement>(null);

  /* eslint-disable react/jsx-props-no-spreading */
  const Scroller = React.useCallback(
    React.forwardRef<HTMLDivElement, React.HTMLProps<HTMLDivElement>>(
      ({ children, ...props }, r) => {
        useDndScrolling(ref, {});
        return (
          <div ref={r} {...props}>
            {children}
          </div>
        );
      }
    ),
    []
  );
  /* eslint-enable react/jsx-props-no-spreading */

  /* eslint-disable react/no-array-index-key */
  const relations = getRelations(
    knowledgeDBs,
    view.relations,
    user.publicKey,
    workspaceID
  );
  const columns = relations ? relations.items.toArray() : [];
  return (
    <TemporaryViewProvider>
      <div className="position-relative flex-grow-1">
        <div className="position-absolute board overflow-y-hidden">
          <DND>
            <Scroller
              ref={ref}
              className="workspace-columns overflow-y-hidden h-100"
            >
              {columns.map((column, index) => {
                return (
                  <PushNode push={List([index])} key={index}>
                    <WorkspaceColumnView />
                  </PushNode>
                );
              })}
              <EmptyColumn />
            </Scroller>
          </DND>
        </div>
      </div>
    </TemporaryViewProvider>
  );
  /* eslint-enable react/no-array-index-key */
}
