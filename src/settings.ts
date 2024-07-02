import { UnsignedEvent } from "nostr-tools";
import { getMostRecentReplacableEvent } from "citadel-commons";
import { List } from "immutable";
import { KIND_SETTINGS } from "./nostr";

function settingsFromEvent(event: UnsignedEvent): Settings {
  try {
    const compressedSettings = JSON.parse(
      event.content
    ) as CompressedSettingsFromStore;
    return {
      bionicReading: compressedSettings.b,
    };
  } catch (e) {
    return {
      bionicReading: false,
    };
  }
}

export const DEFAULT_SETTINGS = {
  bionicReading: false,
};

export function findSettings(events: List<UnsignedEvent>): Settings {
  const settingsEvent = getMostRecentReplacableEvent(
    events.filter((e) => e.kind === KIND_SETTINGS)
  );
  if (!settingsEvent) {
    return DEFAULT_SETTINGS;
  }
  return settingsFromEvent(settingsEvent);
}
