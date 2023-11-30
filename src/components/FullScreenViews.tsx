import React from "react";
import { useNavigate } from "react-router-dom";
import { List } from "immutable";
import {
  ViewContextProvider,
  ViewPath,
  useViewPath,
  viewPathToString,
} from "../ViewContext";
import { Node, getNodesInTree, useIsOpenInFullScreen } from "./Node";
import { NavBar } from "./Navbar";
import { DetailViewMenu } from "./Menu";
import { AddNodeToNode } from "./AddNode";
import { useKnowledgeData } from "../KnowledgeDataContext";
import { ReadingStatus } from "./ReadingStatus";
import { ModalNode, ModalNodeBody } from "./Ui";
import { TreeView } from "./TreeView";
import { DND } from "../dnd";
import { FullScreenViewWrapper } from "./FullScreenViewWrapper";
import { useLogout } from "../NostrAuthContext";

export function RelatedNodes(): JSX.Element | null {
  const { views, repos } = useKnowledgeData();
  const viewPath = useViewPath();
  const isOpenInFullScreen = useIsOpenInFullScreen();
  const nodes = getNodesInTree(
    repos,
    views,
    viewPath,
    List<ViewPath>(),
    isOpenInFullScreen,
    true
  );

  return (
    <ReadingStatus nodes={nodes}>
      {nodes.map((path) => {
        return (
          <ViewContextProvider
            root={path.root}
            indices={path.indexStack}
            key={viewPathToString(path)}
          >
            <div>
              <Node />
            </div>
          </ViewContextProvider>
        );
      })}
    </ReadingStatus>
  );
}

export function DetailView(): JSX.Element | null {
  return (
    <div className="detail-view border-bottom-light">
      <Node />
      <div className="border-bottom-light">
        <DetailViewMenu />
      </div>
      <AddNodeToNode />
    </div>
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
          <div className="position-absolute board scroll pl-2">
            <DetailView />
            <RelatedNodes />
          </div>
        </div>
      </div>
    </FullScreenViewWrapper>
  );
}

export function DesktopView(): JSX.Element {
  const navigate = useNavigate();
  const onHide = (): void => {
    navigate(`/`);
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
