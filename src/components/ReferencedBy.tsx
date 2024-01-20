import React from "react";
import { Droppable } from "react-beautiful-dnd";
import { getRelations, getSubjects } from "../connections";
import {
  updateView,
  useNode,
  useViewKey,
  useViewPath,
  ViewContextProvider,
  viewPathToString,
} from "../ViewContext";
import { DraggableNode } from "./Node";
import { useDeselectAllInView } from "./TemporaryViewContext";
import { ToggleArrowButton } from "./ToggleArrowButton";
import { useData } from "../DataContext";
import { planUpdateViews, usePlanner } from "../planner";
import { newDB } from "../knowledge";

function ReferencedBy(): JSX.Element | null {
  const [node, view] = useNode();
  const { knowledgeDBs, user } = useData();
  const viewPath = useViewPath();
  if (!node) {
    return null;
  }
  const nRelations =
    getRelations(knowledgeDBs, view.relations, user.publicKey)?.items.size || 0;
  const subjects = getSubjects(knowledgeDBs, node.id, user.publicKey);
  /* eslint-disable react/jsx-props-no-spreading */
  return (
    <div className="referenced overflow-y-auto">
      <Droppable
        droppableId={`references:${viewPathToString(viewPath)}`}
        isDropDisabled
      >
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {subjects
              .toList()
              .toArray()
              .map((subject, i) => {
                const path = {
                  root: viewPath.root,
                  indexStack: viewPath.indexStack.push(nRelations + i + 1),
                };
                return (
                  <ViewContextProvider
                    root={path.root}
                    indices={path.indexStack}
                    key={viewPathToString(path)}
                  >
                    <DraggableNode dndIndex={i} sticky />
                  </ViewContextProvider>
                );
              })}
          </div>
        )}
      </Droppable>
    </div>
  );
  /* eslint-enable react/jsx-props-no-spreading */
}

export function ReferencedByCollapsable(): JSX.Element | null {
  const [node, view] = useNode();
  const { createPlan, executePlan } = usePlanner();
  const { knowledgeDBs, user } = useData();
  const { views } = knowledgeDBs.get(user.publicKey, newDB());
  const viewPath = useViewPath();
  const viewKey = useViewKey();
  const deselectByPostfix = useDeselectAllInView();
  if (!node) {
    return null;
  }

  const onChangeDisplayMode = (displaySubjects: boolean): void => {
    if (!views) {
      return;
    }
    executePlan(
      planUpdateViews(
        createPlan(),
        updateView(views, viewPath, { ...view, displaySubjects })
      )
    );
    deselectByPostfix(viewKey);
  };

  const nRelations = getSubjects(knowledgeDBs, node.id, user.publicKey).size;
  if (nRelations === 0) {
    return null;
  }
  return (
    <>
      <div>
        <div className="card">
          <div className="card-body p-3">
            <ToggleArrowButton
              onToggle={onChangeDisplayMode}
              expanded={view.displaySubjects || false}
            >
              {" "}
              Referenced By {`(${nRelations})`}
            </ToggleArrowButton>
          </div>
        </div>
      </div>
      {view.displaySubjects && <ReferencedBy />}
    </>
  );
}
