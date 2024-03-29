import { Event, SimplePool } from "nostr-tools";
import { Map } from "immutable";
import { Plan } from "./planner";
import { FinalizeEvent } from "./Apis";

async function publishEvent(
  relayPool: SimplePool,
  event: Event,
  writeToRelays: Relays
): Promise<PublishResultsOfEvent> {
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
  return writeRelayUrls.reduce((rdx, url, index) => {
    const res = results[index];
    return rdx.set(url, {
      status: res.status,
      reason: res.status === "rejected" ? (res.reason as string) : undefined,
    });
  }, Map<string, PublishStatus>());
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
}): Promise<Array<PublishResultsOfEvent>> {
  if (plan.publishEvents.size === 0) {
    // eslint-disable-next-line no-console
    console.warn("Won't execute Noop plan");
    return Promise.resolve([Map()]);
  }
  const finalizedEvents = plan.publishEvents.map((e) =>
    finalizeEvent(e, plan.user.privateKey)
  );

  return Promise.all(
    finalizedEvents
      .toArray()
      .map((event) => publishEvent(relayPool, event, relays))
  );
}
