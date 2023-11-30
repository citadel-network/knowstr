import React from "react";
import { Outlet } from "react-router-dom";
import Data from "./Data";
import "./App.css";
import { SignInFullScreen } from "./SignIn";
import { useUser } from "./NostrAuthContext";

export function RequireLogin(): JSX.Element {
  const user = useUser();
  if (!user) {
    return <SignInFullScreen />;
  }
  // TODO: not ideal that we automatically start fetching in Require login
  return (
    <Data blockstackUser={user}>
      <Outlet />
    </Data>
  );
}
