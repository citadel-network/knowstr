import React from "react";
import { Droppable } from "react-beautiful-dnd";
import { getRelations, getSubjects } from "../connections";
import { getNode } from "../knowledge";
import { useKnowledgeData, useUpdateKnowledge } from "../KnowledgeDataContext";
import {
  getRepoFromView,
  updateView,
  useViewKey,
  useViewPath,
  ViewContextProvider,
  viewPathToString,
} from "../ViewContext";
import { DraggableNode } from "./Node";
import { useDeselectAllInView } from "./TemporaryViewContext";
import { ToggleArrowButton } from "./ToggleArrowButton";

export function ReferencedBy(): JSX.Element | null {
  const { repos, views } = useKnowledgeData();
  const viewPath = useViewPath();
  const [repo, view] = getRepoFromView(repos, views, viewPath);
  if (!repo) {
    return null;
  }
  const node = getNode(repo, view.branch);
  const nRelations = getRelations(node, view.relationType).size;
  const subjects = getSubjects(repos, repo.id);
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
  const { repos, views } = useKnowledgeData();
  const viewPath = useViewPath();
  const viewKey = useViewKey();
  const updateKnowledge = useUpdateKnowledge();
  const deselectByPostfix = useDeselectAllInView();
  const [repo, view] = getRepoFromView(repos, views, viewPath);
  if (!repo) {
    return null;
  }

  const onChangeDisplayMode = (displaySubjects: boolean): void => {
    updateKnowledge({
      views: updateView(views, viewPath, { ...view, displaySubjects }),
    });
    deselectByPostfix(viewKey);
  };

  const nRelations = getSubjects(repos, repo.id).size;
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
