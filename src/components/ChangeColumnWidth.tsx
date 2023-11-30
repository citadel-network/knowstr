import React from "react";
import { useMediaQuery } from "react-responsive";
import { useKnowledgeData, useUpdateKnowledge } from "../KnowledgeDataContext";
import { getRepoFromView, updateView, useViewPath } from "../ViewContext";
import { IS_MOBILE } from "./responsive";

export function ChangeColumnWidth(): JSX.Element | null {
  const isMobile = useMediaQuery(IS_MOBILE);
  const { repos, views } = useKnowledgeData();
  const viewContext = useViewPath();
  const upsertRepos = useUpdateKnowledge();
  const view = getRepoFromView(repos, views, viewContext)[1];
  if (!view) {
    return null;
  }
  if (isMobile) {
    return null;
  }
  const onIncreaseColumnWidth = (): void => {
    upsertRepos({
      views: updateView(views, viewContext, { ...view, width: view.width + 1 }),
    });
  };
  const onDecreaseColumnWidth = (): void => {
    upsertRepos({
      views: updateView(views, viewContext, {
        ...view,
        width: Math.max(view.width - 1, 1),
      }),
    });
  };
  return (
    <>
      {view.width > 1 && (
        <button
          type="button"
          aria-label="decrease width"
          disabled={view.width === 1}
          className="btn btn-borderless"
          onClick={onDecreaseColumnWidth}
        >
          <span className="iconsminds-arrow-left" />
        </button>
      )}
      <button
        type="button"
        aria-label="increase width"
        className="btn btn-borderless"
        onClick={onIncreaseColumnWidth}
      >
        <span className="iconsminds-arrow-right" />
      </button>
    </>
  );
}
