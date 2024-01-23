import React, { useRef } from "react";
import { List } from "immutable";
import { Droppable } from "react-beautiful-dnd";
import {
  useNode,
  useViewKey,
  useViewPath,
  ViewPath,
  ViewContextProvider,
  viewPathToString,
} from "../ViewContext";
import { DraggableNode, getNodesInTree, useIsOpenInFullScreen } from "./Node";
import { ReadingStatus } from "./ReadingStatus";
import { ReferencedByCollapsable } from "./ReferencedBy";
import { useData } from "../DataContext";

/* eslint-disable react/jsx-props-no-spreading */
export function TreeView(): JSX.Element | null {
  const { knowledgeDBs, user } = useData();
  const scrollContainer = useRef<HTMLDivElement | null>(null);
  const viewKey = useViewKey();
  const viewPath = useViewPath();
  const isOpenInFullScreen = useIsOpenInFullScreen();
  const nodes = getNodesInTree(
    knowledgeDBs,
    user.publicKey,
    viewPath,
    List<ViewPath>(),
    isOpenInFullScreen
  );
  const [node] = useNode();
  const ariaLabel = node ? `related to ${node.text}` : undefined;

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
