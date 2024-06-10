import React from "react";
import { List } from "immutable";
import {
  ViewContext,
  ViewPath,
  useViewPath,
  viewPathToString,
} from "../ViewContext";
import { Node, getNodesInTree, useIsOpenInFullScreen } from "./Node";
import { NavBar } from "./Navbar";
import { DetailViewMenu } from "./Menu";
import { AddNodeToNode } from "./AddNode";
import { TreeViewNodeLoader } from "./TreeView";
import { FullScreenViewWrapper } from "./FullScreenViewWrapper";
import { useLogout } from "../NostrAuthContext";
import { useData } from "../DataContext";

function DetailView(): JSX.Element | null {
  return (
    <div className="detail-view border-bottom-light">
      <div className="font-size-big">
        <Node />
      </div>
      <div className="border-bottom-light">
        <DetailViewMenu />
      </div>
      <AddNodeToNode />
    </div>
  );
}

function MobileViewNodes(): JSX.Element | null {
  const data = useData();
  const viewPath = useViewPath();
  const isOpenInFullScreen = useIsOpenInFullScreen();
  const nodes = getNodesInTree(
    data,
    viewPath,
    List<ViewPath>(),
    isOpenInFullScreen,
    true
  );

  return (
    <TreeViewNodeLoader nodes={nodes}>
      <DetailView />
      {nodes.map((path) => {
        return (
          <ViewContext.Provider value={path} key={viewPathToString(path)}>
            <div id={viewPathToString(path)}>
              <Node />
            </div>
          </ViewContext.Provider>
        );
      })}
    </TreeViewNodeLoader>
  );
}

export function MobileView(): JSX.Element | null {
  const logout = useLogout();
  return (
    <FullScreenViewWrapper>
      <div
        id="app-container"
        className="menu-sub-hidden main-hidden sub-hidden h-100 d-flex flex-column"
      >
        <NavBar logout={logout} />
        <div className="background-white position-relative flex-grow-1">
          <div className="position-absolute board ps-2 overflow-y-auto">
            <MobileViewNodes />
          </div>
        </div>
      </div>
    </FullScreenViewWrapper>
  );
}
