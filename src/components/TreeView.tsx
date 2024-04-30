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
  useQueryKnowledgeData,
} from "../dataQuery";
import { newDB } from "../knowledge";

/* eslint-disable react/jsx-props-no-spreading */
function Tree(): JSX.Element | null {
  const { knowledgeDBs, user, contacts } = useData();
  const { views } = knowledgeDBs.get(user.publicKey, newDB());
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

  const baseFilter = createBaseFilter(contacts, user.publicKey);

  const filter = nodes.reduce((rdx, path) => {
    const [nodeID] = getNodeIDFromView(
      knowledgeDBs,
      views,
      user.publicKey,
      path
    );
    const filterWithNode = addReferencedByToFilters(
      addNodeToFilters(rdx, nodeID),
      nodeID
    );
    return filterWithNode;
  }, baseFilter);

  const { knowledgeDBs: mergedDBs } = useQueryKnowledgeData(filter);

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
    <MergeKnowledgeDB knowledgeDBs={mergedDBs}>
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
    </MergeKnowledgeDB>
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
  const { knowledgeDBs: mergedDBs } = useQueryKnowledgeData(listsFilter);

  return (
    <MergeKnowledgeDB knowledgeDBs={mergedDBs}>
      <Tree />
    </MergeKnowledgeDB>
  );
}
