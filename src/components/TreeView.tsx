import React, { useRef } from "react";
import { List } from "immutable";
import { Droppable } from "@hello-pangea/dnd";
import {
  useNode,
  useViewKey,
  useViewPath,
  ViewPath,
  viewPathToString,
  ViewContext,
} from "../ViewContext";
import { DraggableNode, getNodesInTree, useIsOpenInFullScreen } from "./Node";
import { ReadingStatus } from "./ReadingStatus";
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
                  <ViewContext.Provider
                    value={path}
                    key={viewPathToString(path)}
                  >
                    <div>
                      <DraggableNode dndIndex={index} />
                    </div>
                  </ViewContext.Provider>
                );
              })}
              {provided.placeholder}
            </div>
          );
        }}
      </Droppable>
    </ReadingStatus>
  );
}
