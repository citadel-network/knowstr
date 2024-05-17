import React from "react";
import { useMediaQuery } from "react-responsive";
import { updateView, useNode, useViewPath } from "../ViewContext";
import { IS_MOBILE } from "./responsive";
import { useData } from "../DataContext";
import { planUpdateViews, usePlanner } from "../planner";

export function ChangeColumnWidth(): JSX.Element | null {
  const isMobile = useMediaQuery(IS_MOBILE);
  const { views } = useData();
  const { createPlan, executePlan } = usePlanner();
  const viewContext = useViewPath();
  const view = useNode()[1];
  if (!view || !views) {
    return null;
  }
  if (isMobile) {
    return null;
  }
  const onIncreaseColumnWidth = (): void => {
    executePlan(
      planUpdateViews(
        createPlan(),
        updateView(views, viewContext, {
          ...view,
          width: view.width + 1,
        })
      )
    );
  };
  const onDecreaseColumnWidth = (): void => {
    executePlan(
      planUpdateViews(
        createPlan(),
        updateView(views, viewContext, {
          ...view,
          width: Math.max(view.width - 1, 1),
        })
      )
    );
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
