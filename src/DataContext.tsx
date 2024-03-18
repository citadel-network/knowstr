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
  user,
  settings,
  relays,
  knowledgeDBs,
  relaysInfos,
  publishResults,
  loadingResults,
}: DataContextProps & {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <DataContext.Provider
      value={{
        contacts,
        user,
        settings,
        relays,
        knowledgeDBs,
        relaysInfos,
        publishResults,
        loadingResults,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
