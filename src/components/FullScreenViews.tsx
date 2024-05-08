import React from "react";
import { useNavigate } from "react-router-dom";
import { List } from "immutable";
import { ModalNode, ModalNodeBody } from "citadel-commons";
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
import { TreeView, TreeViewNodeLoader } from "./TreeView";
import { DND } from "../dnd";
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
  const { knowledgeDBs, user } = useData();
  const viewPath = useViewPath();
  const isOpenInFullScreen = useIsOpenInFullScreen();
  const nodes = getNodesInTree(
    knowledgeDBs,
    user.publicKey,
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
        <div className="background-white position-relative asset-workspace-height">
          <div className="position-absolute board ps-2 overflow-y-auto">
            <MobileViewNodes />
          </div>
        </div>
      </div>
    </FullScreenViewWrapper>
  );
}

export function DesktopView(): JSX.Element {
  const navigate = useNavigate();
  const onHide = (): void => {
    navigate("/");
  };
  return (
    <FullScreenViewWrapper>
      <ModalNode onHide={onHide}>
        <ModalNodeBody>
          <DetailView />
          <DND>
            <TreeView />
          </DND>
        </ModalNodeBody>
      </ModalNode>
    </FullScreenViewWrapper>
  );
}
