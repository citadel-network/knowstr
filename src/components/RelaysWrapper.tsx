import React from "react";
import { useNavigate } from "react-router-dom";
import { Relays } from "../commoncomponents/Relays";
import { useData } from "../DataContext";
import { useDefaultRelays } from "../NostrAuthContext";
import { planPublishRelayMetadata, usePlanner } from "../planner";
import { useProjectContext } from "../ProjectContext";
import { useRelaysForRelayManagement } from "../relays";

export function RelaysWrapper(): JSX.Element {
  const navigate = useNavigate();
  const { createPlan, executePlan } = usePlanner();
  const defaultRelays = useDefaultRelays();
  const { contactsRelays } = useData();
  const relays = useRelaysForRelayManagement();
  const { projectID } = useProjectContext();
  const submit = async (relayState: Relays): Promise<void> => {
    if (projectID) {
      return;
    }
    const plan = planPublishRelayMetadata(createPlan(), relayState);
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
