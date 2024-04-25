import React from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../DataContext";
import { useDefaultRelays } from "../NostrAuthContext";
import { Relays } from "./Relays";
import { mergeRelays } from "../relays";
import { planPublishRelayMetadata, usePlanner } from "../planner";

export function RelaysWrapper(): JSX.Element {
  const navigate = useNavigate();
  const { createPlan, executePlan } = usePlanner();
  const defaultRelays = useDefaultRelays();
  const { relays, contactsRelays } = useData();
  const submit = async (relayState: Relays): Promise<void> => {
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
      defaultRelays={defaultRelays}
      relays={relays}
      contactsRelays={contactsRelays}
      onSubmit={submit}
    />
  );
}
