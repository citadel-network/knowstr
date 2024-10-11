import React from "react";
import { useNavigate } from "react-router-dom";
import { Relays, mergeRelays } from "citadel-commons";
import { useData } from "../DataContext";
import { useDefaultRelays } from "../NostrAuthContext";
import { planPublishRelayMetadata, usePlanner } from "../planner";
import { useProjectContext } from "../ProjectContext";

export function RelaysWrapper(): JSX.Element {
  const navigate = useNavigate();
  const { createPlan, executePlan } = usePlanner();
  const defaultRelays = useDefaultRelays();
  const { relays, contactsRelays } = useData();
  const { projectID } = useProjectContext();
  const submit = async (relayState: Relays): Promise<void> => {
    if (projectID) {
      return;
    }
    // publish on old and new relays as well as default relays
    const allRelays = mergeRelays(
      defaultRelays,
      mergeRelays(relays, relayState)
    );
    const plan = planPublishRelayMetadata(
      { ...createPlan(), relays: allRelays },
      relayState
    );
    await executePlan(plan);
    navigate("/");
  };
  return (
    <Relays
      readonly={!!projectID}
      defaultRelays={defaultRelays}
      relays={relays}
      contactsRelays={contactsRelays}
      onSubmit={submit}
    />
  );
}
