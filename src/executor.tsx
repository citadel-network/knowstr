import { Event, SimplePool } from "nostr-tools";
import { Plan } from "./planner";
import { FinalizeEvent } from "./Apis";

async function publishEvent(
  relayPool: SimplePool,
  event: Event,
  writeToRelays: Relays
): Promise<void> {
  const writeRelayUrls = writeToRelays.map((r) => r.url);

  if (writeRelayUrls.length === 0) {
    throw new Error("No relays to publish on");
  }
  const results = await Promise.allSettled(
    relayPool.publish(writeRelayUrls, event)
  );
  // If one message can be sent publish is a success,
  // otherwise it's a failure
  const failures = results.filter((res) => res.status === "rejected");
  if (failures.length === writeRelayUrls.length) {
    // Reject only when all have failed
    // eslint-disable-next-line no-console
    failures.map((failure) => console.error(failure, event));
    throw new Error(
      `Failed to publish on: ${failures
        .map((failure) => failure.status)
        .join(".")}`
    );
  }
}

export async function execute({
  plan,
  relayPool,
  relays,
  finalizeEvent,
}: {
  plan: Plan;
  relayPool: SimplePool;
  relays: Relays;
  finalizeEvent: FinalizeEvent;
}): Promise<void> {
  if (plan.publishEvents.size === 0) {
    // eslint-disable-next-line no-console
    console.warn("Won't execute Noop plan");
    return;
  }
  const finalizedEvents = plan.publishEvents.map((e) =>
    finalizeEvent(e, plan.user.privateKey)
  );
  await Promise.all(
    finalizedEvents
      .toArray()
      .map((event) => publishEvent(relayPool, event, relays))
  );
}
