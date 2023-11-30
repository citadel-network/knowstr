import React from "react";
import { Route, Routes } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import Dashboard from "./components/Dashboard";
import Invite, { VCard } from "./components/Invite";
import { IS_MOBILE } from "./components/responsive";
import { DesktopView, MobileView } from "./components/FullScreenViews";
import { EditRelays } from "./components/EditRelays";
import { RequireLogin } from "./AppState";
import { SignUp } from "./SignUp";
import { SignInFullScreen } from "./SignIn";

export const FULL_SCREEN_PATH = "/d/:openNodeID";

export function App(): JSX.Element {
  const isMobile = useMediaQuery(IS_MOBILE);
  return (
    <Routes>
      <Route element={<RequireLogin />}>
        <Route path="/w/:workspaceID" element={<Dashboard />} />
        {isMobile && <Route path={FULL_SCREEN_PATH} element={<MobileView />} />}
        <Route path="/" element={<Dashboard />}>
          <Route path="/vcard" element={<VCard />} />
          <Route path="/invite" element={<Invite />} />
          <Route path="/relays" element={<EditRelays />} />
          <Route path={FULL_SCREEN_PATH} element={<DesktopView />} />
        </Route>
      </Route>
      <Route path="/signin" element={<SignInFullScreen />} />
      <Route path="/signup" element={<SignUp />} />
    </Routes>
  );
}
