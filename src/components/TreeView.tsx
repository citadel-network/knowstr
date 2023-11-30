import React, { useRef } from "react";
import { List } from "immutable";
import { Droppable } from "react-beautiful-dnd";
import { branchPathToString, getNode } from "../knowledge";
import { useGetNodeText, useKnowledgeData } from "../KnowledgeDataContext";
import {
  useRepo,
  useViewKey,
  useViewPath,
  ViewPath,
  ViewContextProvider,
  viewPathToString,
} from "../ViewContext";
import { DraggableNode, getNodesInTree, useIsOpenInFullScreen } from "./Node";
import { ReadingStatus } from "./ReadingStatus";
import { ReferencedByCollapsable } from "./ReferencedBy";

/* eslint-disable react/jsx-props-no-spreading */
export function TreeView(): JSX.Element | null {
  const { repos, views } = useKnowledgeData();
  const scrollContainer = useRef<HTMLDivElement | null>(null);
  const viewKey = useViewKey();
  const viewPath = useViewPath();
  const getNodeText = useGetNodeText();
  const isOpenInFullScreen = useIsOpenInFullScreen();
  const nodes = getNodesInTree(
    repos,
    views,
    viewPath,
    List<ViewPath>(),
    isOpenInFullScreen
  );
  const [r, v] = useRepo();
  const ariaLabel = r
    ? `related to ${getNodeText(getNode(r, v.branch))} [${branchPathToString(
        v.branch
      )}]`
    : undefined;

  return (
    <ReadingStatus nodes={nodes} ariaLabel={ariaLabel}>
      <Droppable droppableId={`tree:${viewKey}`}>
        {(provided, snapshot) => {
          // It's important for react-beautiful-dnd that the height of the scroll container doesn't change when we remove elements
          const style =
            snapshot.draggingFromThisWith && scrollContainer.current
              ? { height: `${scrollContainer.current.clientHeight}px` }
              : undefined;
          return (
            <div
              {...provided.droppableProps}
              ref={(el) => {
                provided.innerRef(el);
                // eslint-disable-next-line functional/immutable-data
                scrollContainer.current = el;
              }}
              style={style}
              className="background-dark"
            >
              {nodes.map((path, index) => {
                // Don't show children of the Node beeing dragged
                if (
                  snapshot.draggingOverWith &&
                  viewPathToString(path).startsWith(
                    snapshot.draggingOverWith
                  ) &&
                  viewPathToString(path) !== snapshot.draggingOverWith
                ) {
                  return null;
                }
                return (
                  <ViewContextProvider
                    root={path.root}
                    indices={path.indexStack}
                    key={viewPathToString(path)}
                  >
                    <div>
                      <DraggableNode dndIndex={index} />
                    </div>
                  </ViewContextProvider>
                );
              })}
              {provided.placeholder}
            </div>
          );
        }}
      </Droppable>
      <ReferencedByCollapsable />
    </ReadingStatus>
  );
}
