import React, { useState } from "react";
import { List } from "immutable";
import { ListRange, ScrollerProps, Virtuoso } from "react-virtuoso";
import { useDndScrolling } from "react-dnd-scrolling";
import { ListItem } from "./Draggable";
import {
  useNode,
  useViewPath,
  ViewPath,
  viewPathToString,
  ViewContext,
  useViewKey,
  getNodeIDFromView,
  getLast,
  parseViewPath,
} from "../ViewContext";
import { getNodesInTree, useIsOpenInFullScreen } from "./Node";
import { MergeKnowledgeDB, useData } from "../DataContext";
import {
  addListToFilters,
  addNodeToFilters,
  addReferencedByToFilters,
  createBaseFilter,
  filtersToFilterArray,
  useQueryKnowledgeData,
} from "../dataQuery";
import { RegisterQuery } from "../LoadingStatus";
import { shortID } from "../connections";

const LOAD_EXTRA = 10;

export function TreeViewNodeLoader({
  children,
  nodes,
  range,
}: {
  range?: ListRange;
  children: React.ReactNode;
  nodes: List<ViewPath>;
}): JSX.Element {
  const data = useData();
  const baseFilter = createBaseFilter(data.contacts, data.user.publicKey);

  const nodeIDs = nodes.map((path) => getNodeIDFromView(data, path)[0]);

  const nodeIDsWithRange = range
    ? nodeIDs.slice(range.startIndex, range.endIndex + 1 + LOAD_EXTRA) // +1 because slice doesn't include last element
    : nodeIDs;

  const filter = nodeIDsWithRange.reduce((rdx, nodeID) => {
    const filterWithNode = addReferencedByToFilters(
      addNodeToFilters(rdx, nodeID),
      nodeID
    );
    return filterWithNode;
  }, baseFilter);

  const finalFilter = filtersToFilterArray(filter);
  const { knowledgeDBs: mergedDBs, allEventsProcessed } =
    useQueryKnowledgeData(finalFilter);

  return (
    <MergeKnowledgeDB knowledgeDBs={mergedDBs}>
      <RegisterQuery
        nodesBeeingQueried={nodeIDs.map((longID) => shortID(longID)).toArray()}
        allEventsProcessed={allEventsProcessed}
      >
        {children}
      </RegisterQuery>
    </MergeKnowledgeDB>
  );
}

/* eslint-disable react/jsx-props-no-spreading */
function Tree(): JSX.Element | null {
  const data = useData();
  const [totalListHeight, setTotalListHeight] = useState<number | undefined>(
    undefined
  );
  const [range, setRange] = useState<ListRange>({ startIndex: 0, endIndex: 0 });
  const viewPath = useViewPath();
  const isOpenInFullScreen = useIsOpenInFullScreen();
  const nodes = getNodesInTree(
    data,
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
    <TreeViewNodeLoader nodes={nodes} range={range}>
      <div
        className="max-height-100 overflow-hidden background-dark"
        aria-label={ariaLabel}
        style={virtuosoStyle}
      >
        <Virtuoso
          data={nodes.toArray()}
          totalListHeightChanged={(height) => {
            setTotalListHeight(height);
          }}
          rangeChanged={(r) => {
            if (r.startIndex === 0 && r.endIndex === 0) {
              return;
            }
            setRange(r);
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
    </TreeViewNodeLoader>
  );
}

export function TreeView(): JSX.Element {
  const data = useData();
  const key = useViewKey();
  const filter = createBaseFilter(data.contacts, data.user.publicKey);

  // Find all Lists attached to all Nodes and subnodes of this tree
  const lists = data.views
    .filter(
      (view, path) => path.startsWith(key) && view.expanded && path !== key
    )
    .map((view) => view.relations || ("" as LongID))
    .filter((r) => r !== "");
  const listsFilter = lists.reduce(
    (rdx, listID, path) =>
      addListToFilters(rdx, listID, getLast(parseViewPath(path)).nodeID),
    filter
  );
  const { knowledgeDBs } = useQueryKnowledgeData(
    filtersToFilterArray(listsFilter)
  );

  return (
    <MergeKnowledgeDB knowledgeDBs={knowledgeDBs}>
      <Tree />
    </MergeKnowledgeDB>
  );
}
