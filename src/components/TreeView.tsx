import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { List } from "immutable";
import { Virtuoso } from "react-virtuoso";
import {
  useNode,
  useViewKey,
  useViewPath,
  ViewPath,
  viewPathToString,
  ViewContext,
  parseViewPath,
} from "../ViewContext";
import { Node, getNodesInTree, useIsOpenInFullScreen } from "./Node";
import { useData } from "../DataContext";

window.addEventListener("error", (e) => {
  if (
    e.message ===
      "ResizeObserver loop completed with undelivered notifications." ||
    e.message === "ResizeObserver loop limit exceeded"
  ) {
    e.stopImmediatePropagation();
  }
});

function Item({ path, isDragging }: { path: ViewPath; isDragging: boolean }) {
  return (
    <div className={`item ${isDragging ? "is-dragging" : ""}`}>
      <ViewContext.Provider value={path}>
        <Node />
      </ViewContext.Provider>
    </div>
  );
}

// TODO: FIX
//  - drag over doesn't scroll
// - fix spaceholder

/*
function addDraggingCopy(
  snapshot: DroppableStateSnapshot,
  nodes: List<ViewPath>
): List<ViewPath | string> {
  if (
    !snapshot.draggingFromThisWith ||
    // If user drags an item from this list over this list, no need to add a copy as it's just reordering
    snapshot.draggingFromThisWith === snapshot.draggingOverWith
  ) {
    return nodes;
  }
  const index = nodes.findIndex(
    (path) => viewPathToString(path) === snapshot.draggingFromThisWith
  );
  console.log(">> add copy to", index + 1);
  return (nodes as List<ViewPath | string>).insert(
    index + 1,
    `copy:${snapshot.draggingFromThisWith}`
  );
}
   */

/*
function calculateMaxHeight(
  listHeight: number,
  snapshot: DroppableStateSnapshot
): number {
  // remove height of copy placeholder
  if (snapshot.draggingFromThisWith && !snapshot.draggingOverWith) {
    console.log(">> dragging away");
    return listHeight + 75;
  }
  // If another item gets dragged over this list, we need to add space for the placeholder
  if (snapshot.draggingOverWith && !snapshot.draggingFromThisWith) {
    console.log(">> add list height");
    return listHeight + 2500;
  }
  return listHeight;
}
   */

/* eslint-disable react/jsx-props-no-spreading */
export function TreeView(): JSX.Element | null {
  const { knowledgeDBs, user } = useData();
  const [totalListHeight, setTotalListHeight] = useState<number | undefined>(
    undefined
  );
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

  const HeightPreservingItem = React.useCallback(
    ({
      children,
      ...props
    }: {
      children?: ReactNode;
      "data-known-size": number;
    }) => {
      const [size, setSize] = useState<number>(0);
      const knownSize = props["data-known-size"];
      useEffect(() => {
        setSize((prevSize) => {
          return knownSize === 0 ? prevSize : knownSize;
        });
      }, [knownSize]);
      const style = {
        "--child-height": `${size}px`,
      } as React.CSSProperties;
      return (
        <div {...props} className="height-preserving-container" style={style}>
          {children}
        </div>
      );
    },
    []
  );

  const maxHeight = totalListHeight; // calculateMaxHeight(totalListHeight || 0, snapshot);
  const virtuosoStyle = totalListHeight
    ? { maxHeight: "100%", height: `${maxHeight}px` }
    : { height: "1px" };

  // const nodesWithCopy = addDraggingCopy(snapshot, nodes);
  const nodesWithCopy = nodes;

  return (
    <div
      className="max-100 overflow-y-hidden background-dark"
      aria-label={ariaLabel}
    >
      <Virtuoso
        data={nodesWithCopy.toArray()}
        style={virtuosoStyle}
        totalListHeightChanged={(height) => {
          setTotalListHeight(height);
        }}
        components={{ Item: HeightPreservingItem }}
        itemContent={(index, path) => {
          if (typeof path === "string") {
            const p = parseViewPath(path.substring(5));
            return (
              <ViewContext.Provider value={p} key={path}>
                <Item path={p} isDragging={false} />
              </ViewContext.Provider>
            );
          }

          return (
            <ViewContext.Provider value={path} key={viewPathToString(path)}>
              <Item path={path} isDragging={false} />
            </ViewContext.Provider>
          );
        }}
      />
    </div>
  );
}
