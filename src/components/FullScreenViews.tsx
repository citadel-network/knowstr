import React from "react";
import { useNavigate } from "react-router-dom";
import { ModalNode, ModalNodeBody } from "citadel-commons";
import { Node } from "./Node";
import { NavBar } from "./Navbar";
import { DetailViewMenu } from "./Menu";
import { AddNodeToNode } from "./AddNode";
import { TreeView } from "./TreeView";
import { DND } from "../dnd";
import { FullScreenViewWrapper } from "./FullScreenViewWrapper";
import { useLogout } from "../NostrAuthContext";

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
          <div className="position-absolute board ps-2 overflow-y-hidden">
            <DetailView />
            <TreeView />
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
        <ModalNodeBody className="flex-col">
          <DetailView />
          <DND>
            <TreeView />
          </DND>
        </ModalNodeBody>
      </ModalNode>
    </FullScreenViewWrapper>
  );
}
