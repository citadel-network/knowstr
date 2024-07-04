import React from "react";
import { useMediaQuery } from "react-responsive";
import { useData } from "../DataContext";
import { IS_MOBILE } from "./responsive";
import { usePlanner } from "../planner";
import { PublishingStatus } from "./PublishingStatus";

export function PublishingStatusWrapper(): JSX.Element | null {
  const isMobile = useMediaQuery(IS_MOBILE);
  const { publishEventsStatus, relays } = useData();
  const { republishEvents } = usePlanner();
  return (
    <PublishingStatus
      isMobile={isMobile}
      publishEventsStatus={publishEventsStatus}
      relays={relays}
      republishEvents={republishEvents}
    />
  );
}
