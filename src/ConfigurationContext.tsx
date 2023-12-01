import React from "react";

type Configuration = {
  bootstrapInterval: number;
};

const ConfigurationContext = React.createContext<Configuration | undefined>(
  undefined
);

export function useConfiguration(): Configuration {
  const context = React.useContext(ConfigurationContext);
  if (context === undefined) {
    throw new Error("Configuration Context not provided");
  }
  return { ...context };
}

const defaults: Configuration = {
  bootstrapInterval: 10,
};

type Props = Partial<Configuration> & {
  children: React.ReactNode;
};

export function ConfigurationContextProvider({
  children,
  ...p
}: Props): JSX.Element {
  const values: Configuration = {
    bootstrapInterval: p.bootstrapInterval || defaults.bootstrapInterval,
  };
  return (
    <ConfigurationContext.Provider value={values}>
      {children}
    </ConfigurationContext.Provider>
  );
}
