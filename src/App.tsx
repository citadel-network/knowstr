import React from "react";
import { Route, Routes } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import Dashboard from "./components/Dashboard";
import { Follow } from "./components/Follow";
import { IS_MOBILE } from "./components/responsive";
import { DesktopView, MobileView } from "./components/FullScreenViews";
import { RelaysWrapper } from "./components/RelaysWrapper";
import { RequireLogin } from "./AppState";
import { SignUp } from "./SignUp";
import { SignInModal } from "./SignIn";
import { Profile } from "./components/Profile";

export const FULL_SCREEN_PATH = "/d/:openNodeID";

export function App(): JSX.Element {
  const isMobile = useMediaQuery(IS_MOBILE);
  return (
    <Routes>
      <Route element={<RequireLogin />}>
        <Route path="/w/:workspaceID" element={<Dashboard />} />
        {isMobile && <Route path={FULL_SCREEN_PATH} element={<MobileView />} />}
        <Route path="/" element={<Dashboard />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/follow" element={<Follow />} />
          <Route path="/relays" element={<RelaysWrapper />} />
          <Route path={FULL_SCREEN_PATH} element={<DesktopView />} />
          <Route path="/signin" element={<SignInModal />} />
          <Route path="/signup" element={<SignUp />} />
        </Route>
      </Route>
    </Routes>
  );
}
