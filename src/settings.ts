import { useEffect, useState } from "react";
import { Event, getPublicKey, nip04 } from "nostr-tools";
import { useEventQuery } from "citadel-commons";
import { KIND_SETTINGS } from "./nostr";
import { useApis } from "./Apis";

async function settingsFromEvent(
  event: Event,
  myself: KeyPair
): Promise<Settings> {
  try {
    const decryptedSettings = await nip04.decrypt(
      myself.privateKey,
      event.pubkey as PublicKey,
      event.content
    );
    const compressedSettings = JSON.parse(
      decryptedSettings.toString()
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
