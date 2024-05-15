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
import { newDB } from "../knowledge";
import { RegisterQuery } from "../LoadingStatus";
import { splitID } from "../connections";

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
  const { user, contacts, knowledgeDBs } = useData();
  const baseFilter = createBaseFilter(contacts, user.publicKey);
  const { views } = knowledgeDBs.get(user.publicKey, newDB());

  const nodeIDs = nodes.map(
    (path) =>
      splitID(
        getNodeIDFromView(knowledgeDBs, views, user.publicKey, path)[0]
      )[1]
  );

  const nodeIDsWithRange = range
    ? nodeIDs.slice(range.startIndex, range.endIndex + 1 + LOAD_EXTRA) // +1 because slice doesn't include last element
    : nodeIDs;

  const filter = nodeIDsWithRange.reduce((rdx, nodeID) => {
    const filterWithNode = addReferencedByToFilters(
      addNodeToFilters(rdx, nodeID as LongID),
      nodeID as LongID
    );
    return filterWithNode;
  }, baseFilter);

  const finalFilter = filtersToFilterArray(filter);
  const { knowledgeDBs: mergedDBs, allEventsProcessed } =
    useQueryKnowledgeData(finalFilter);

  return (
    <MergeKnowledgeDB knowledgeDBs={mergedDBs}>
      <RegisterQuery
        nodesBeeingQueried={nodeIDs.toArray()}
        allEventsProcessed={allEventsProcessed}
      >
        {children}
      </RegisterQuery>
    </MergeKnowledgeDB>
  );
}

/* eslint-disable react/jsx-props-no-spreading */
function Tree(): JSX.Element | null {
  const { knowledgeDBs, user } = useData();
  const [totalListHeight, setTotalListHeight] = useState<number | undefined>(
    undefined
  );
  const [range, setRange] = useState<ListRange>({ startIndex: 0, endIndex: 0 });
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
    <TreeViewNodeLoader nodes={nodes} range={range}>
      <div
        className="max-height-100 overfloallEventsProcessedhidden background-dark"
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
  const { user, contacts, knowledgeDBs } = useData();
  const key = useViewKey();
  const filter = createBaseFilter(contacts, user.publicKey);
  const myDB = knowledgeDBs.get(user.publicKey, newDB());
  const { views } = myDB;

  // Find all Lists attached to all Nodes and subnodes of this tree
  const lists = views
    .filter(
      (view, path) => path.startsWith(key) && view.expanded && path !== key
    )
    .map((view) => view.relations || ("" as LongID))
    .valueSeq()
    .toArray()
    .filter((r) => r !== "");
  const listsFilter = lists.reduce(
    (rdx, listID) => addListToFilters(rdx, listID),
    filter
  );
  const { knowledgeDBs: mergedDBs } = useQueryKnowledgeData(
    filtersToFilterArray(listsFilter)
  );

  return (
    <MergeKnowledgeDB knowledgeDBs={mergedDBs}>
      <Tree />
    </MergeKnowledgeDB>
  );
}
