import { Map } from "immutable";
import { useData } from "../DataContext";

export function useInviteNotifications(): Map<string, NotificationMessage> {
  const { contacts, broadcastKeys } = useData();
  return contacts
    .filter((contact: Contact) => {
      return !broadcastKeys.get(contact.publicKey);
    })
    .map((value) => {
      return {
        title: "Finish Connection",
        message: `Click to finish Connection`,
        date: value.createdAt ? new Date(value.createdAt) : undefined,
        navigateToLink: `/invite?publicKey=${value.publicKey}`,
      };
    });
}
