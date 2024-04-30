import React from "react";
import { Outlet } from "react-router-dom";

import { useMediaQuery } from "react-responsive";
import { NavBar } from "./Navbar";

import { WorkspaceView } from "./Workspace";

import { MobileView } from "./FullScreenViews";
import { IS_MOBILE } from "./responsive";
import { useLogout } from "../NostrAuthContext";
import { LoadNode } from "../dataQuery";

function Dashboard(): JSX.Element {
  const logout = useLogout();
  const isMobile = useMediaQuery(IS_MOBILE);

  if (isMobile) {
    return (
      <LoadNode waitForEose>
        <Outlet />
        <MobileView />
      </LoadNode>
    );
  }
  return (
    <LoadNode waitForEose>
      <div className="h-100 w-100 position-absolute knowledge-exchange">
        <div
          id="app-container"
          className="menu-sub-hidden main-hidden sub-hidden h-100 d-flex flex-column"
        >
          <NavBar logout={logout} />
          <Outlet />
          <WorkspaceView />
        </div>
      </div>
    </LoadNode>
  );
}
export default Dashboard;
