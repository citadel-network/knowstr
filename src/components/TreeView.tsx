import React, { useState } from "react";
import { List } from "immutable";
import { ScrollerProps, Virtuoso } from "react-virtuoso";
import { useDndScrolling } from "react-dnd-scrolling";
import { ListItem } from "./Draggable";
import {
  useNode,
  useViewPath,
  ViewPath,
  viewPathToString,
  ViewContext,
} from "../ViewContext";
import { getNodesInTree, useIsOpenInFullScreen } from "./Node";
import { useData } from "../DataContext";

/* eslint-disable react/jsx-props-no-spreading */
export function TreeView(): JSX.Element | null {
  const { knowledgeDBs, user } = useData();
  const [totalListHeight, setTotalListHeight] = useState<number | undefined>(
    undefined
  );
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
  const virtuosoStyle = totalListHeight
    ? { maxHeight: "100%", height: `${totalListHeight}px` }
    : { height: "1px" };

  const Scroller = React.useCallback(
    React.forwardRef<HTMLDivElement, ScrollerProps>(
      ({ style, ...props }, ref) => {
        useDndScrolling(ref, {});
        return <div style={style} ref={ref} {...props} />;
      }
    ),
    []
  );

  return (
    <div
      className="max-height-100 overflow-y-hidden background-dark"
      aria-label={ariaLabel}
      style={virtuosoStyle}
    >
      <Virtuoso
        data={nodes.toArray()}
        totalListHeightChanged={(height) => {
          setTotalListHeight(height);
        }}
        components={{ Scroller }}
        itemContent={(index, path) => {
          return (
            <ViewContext.Provider value={path} key={viewPathToString(path)}>
              <ListItem index={index} treeViewPath={viewPath} />
            </ViewContext.Provider>
          );
        }}
      />
    </div>
  );
}
