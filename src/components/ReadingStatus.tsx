import { List, OrderedMap, Map } from "immutable";
import React, { useEffect, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useApis } from "../Apis";
import { useKnowledgeData } from "../KnowledgeDataContext";
import {
  getRepoFromView,
  useViewKey,
  useViewPath,
  ViewPath,
  viewPathToString,
} from "../ViewContext";

function isScrolledPastTopOfBorderOfNode(
  elementId: string,
  topBorderMap: OrderedMap<string, number>,
  topBorder: number
): boolean | null {
  const elementTopBorder = topBorderMap.get(elementId, null);
  const elementMargin = 10;
  return elementTopBorder ? elementTopBorder - elementMargin < topBorder : null;
}

function getScrolledIntoNode(
  nodesListTop: number,
  sortedTopBorderMap: OrderedMap<string, number>
): string {
  type GetScrolledIntoNodeReducer = {
    firstKey: string;
    isFinished: boolean;
  };
  return sortedTopBorderMap.reduce(
    (
      reducer: GetScrolledIntoNodeReducer,
      value: number,
      key: string
    ): GetScrolledIntoNodeReducer => {
      if (reducer.isFinished) {
        return reducer;
      }
      if (
        isScrolledPastTopOfBorderOfNode(
          key,
          sortedTopBorderMap,
          nodesListTop
        ) === null
      ) {
        return {
          firstKey: reducer.firstKey,
          isFinished: false,
        };
      }
      if (
        isScrolledPastTopOfBorderOfNode(key, sortedTopBorderMap, nodesListTop)
      ) {
        return {
          firstKey: key,
          isFinished: false,
        };
      }
      return {
        firstKey: reducer.firstKey,
        isFinished: true,
      };
    },
    {
      firstKey: sortedTopBorderMap.keySeq().get(0, ""),
      isFinished: false,
    }
  ).firstKey;
}

export function ReadingStatus({
  nodes,
  children,
  ariaLabel,
}: {
  nodes: List<ViewPath>;
  children: React.ReactNode;
  ariaLabel?: string;
}): JSX.Element {
  const { fileStore } = useApis();
  const { getLocalStorage, setLocalStorage } = fileStore;
  const knowledgeData = useKnowledgeData();
  const nodesListRef = useRef<HTMLDivElement>(null);
  const scrollableId = useViewKey();

  const viewPath = useViewPath();
  const view = getRepoFromView(
    knowledgeData.repos,
    knowledgeData.views,
    viewPath
  )[1];

  const calculateTopBorderMap = (
    renderedNodeList: HTMLDivElement
  ): OrderedMap<string, number> => {
    const borderMap: Map<string, number> = nodes.reduce(
      (map: Map<string, number>, path: ViewPath): Map<string, number> => {
        const innerNode = renderedNodeList.querySelector<HTMLDivElement>(
          `[id='${viewPathToString(path)}']`
        );
        if (innerNode !== null && innerNode !== undefined) {
          return map.set(viewPathToString(path), innerNode.offsetTop);
        }
        return map;
      },
      Map<string, number>()
    );
    const sortedTopBorderMap: OrderedMap<string, number> = borderMap.sort(
      (a, b) => {
        if (a < b) {
          return -1;
        }
        if (a > b) {
          return 1;
        }
        return 0;
      }
    );
    const offset = sortedTopBorderMap.first(0);
    return sortedTopBorderMap.mapEntries<string, number>(([id, topborder]) => [
      id,
      topborder - offset,
    ]);
  };

  const onScroll = (topBorderMap: OrderedMap<string, number>): void => {
    if (scrollableId && nodes.size > 1) {
      const scrollPos = nodesListRef.current
        ? nodesListRef.current.scrollTop
        : 0;
      const elementIdToStorage = getScrolledIntoNode(scrollPos, topBorderMap);
      setLocalStorage(scrollableId, JSON.stringify(elementIdToStorage));
    }
  };
  const debounceOnScroll = useDebouncedCallback<
    (m: OrderedMap<string, number>) => void
  >(onScroll, 300);

  useEffect((): void => {
    if (nodes.size > 1 && nodesListRef.current) {
      const storageItem = scrollableId ? getLocalStorage(scrollableId) : null;
      const elementIdFromStorage =
        storageItem !== null ? (JSON.parse(storageItem) as string) : null;
      const elementFromStorage =
        elementIdFromStorage &&
        nodesListRef.current?.querySelector(`[id='${elementIdFromStorage}']`);
      if (elementFromStorage) {
        const { offsetParent } = elementFromStorage as HTMLElement;
        const initialScrollTop = (offsetParent as HTMLElement).scrollTop;
        elementFromStorage.scrollIntoView(
          "scrollBehavior" in document.documentElement.style
            ? { block: "start", inline: "nearest" }
            : true
        );
        // eslint-disable-next-line functional/immutable-data
        (offsetParent as HTMLElement).scrollTop = initialScrollTop;
      }
      const renderedNodeList = nodesListRef.current;
      if (renderedNodeList) {
        const topBorderMap = calculateTopBorderMap(renderedNodeList);
        nodesListRef.current?.addEventListener("scroll", () =>
          debounceOnScroll(topBorderMap)
        );
        return nodesListRef.current?.removeEventListener<"scroll">(
          "scroll",
          () => debounceOnScroll(topBorderMap)
        );
      }
    }
    return undefined;
  }, [nodes.size, window.URL, view && view.width, nodesListRef.current]);
  if (!view) {
    return <>{children}</>;
  }
  return (
    <div ref={nodesListRef} className="overflow-y-auto" aria-label={ariaLabel}>
      {children}
    </div>
  );
}
