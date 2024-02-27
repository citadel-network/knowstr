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

/*
export function useSettingsQuery(
  user: KeyPair,
  dependenciesEose: boolean,
  readFromRelays: Relays
): [Settings, boolean] {
  const myNostrPubKey = getPublicKey(user.privateKey);
  const { relayPool } = useApis();
  const { events, eose } = useEventQuery(
    relayPool,
    [
      {
        kinds: [KIND_SETTINGS],
        authors: [myNostrPubKey],
      },
    ],
    { enabled: dependenciesEose, readFromRelays }
  );

  const [settings, setSettings] = useState<{
    finished: boolean;
    settings: Settings;
  }>({ settings: DEFAULT_SETTINGS, finished: false });

  useEffect(() => {
    if (!eose) {
      return;
    }
    const updateSettings = async (): Promise<void> => {
      const newest = events
        .sort((a, b) => b.created_at - a.created_at)
        .first(undefined);
      if (!newest) {
        setSettings({ settings: DEFAULT_SETTINGS, finished: true });
        return;
      }
      const newSettings = await settingsFromEvent(newest, user);
      setSettings({ settings: newSettings, finished: true });
    };

    updateSettings();
  }, [events, eose]);
  return [settings.settings, settings.finished];
}
*/
