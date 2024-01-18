import React from "react";

export type DataContextProps = Data;

const DataContext = React.createContext<DataContextProps | undefined>(
  undefined
);

export function useData(): DataContextProps {
  const context = React.useContext(DataContext);
  if (context === undefined) {
    throw new Error("DataContext not provided");
  }
  return context;
}

export function DataContextProvider({
  children,
  contacts,
  contactsOfContacts,
  user,
  sentEvents,
  settings,
  relays,
  knowledgeDBs,
}: DataContextProps & {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <DataContext.Provider
      value={{
        contacts,
        contactsOfContacts,
        user,
        sentEvents,
        settings,
        relays,
        knowledgeDBs,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
