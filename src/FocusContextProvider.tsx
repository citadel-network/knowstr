import React, { useState } from "react";

type InputElementFocus = {
  isInputElementInFocus: boolean;
  setIsInputElementInFocus: (isInputElementInFocus: boolean) => void;
};

export const FocusContext = React.createContext<InputElementFocus | undefined>(
  undefined
);

function getFocusContextOrThrow(): InputElementFocus {
  const context = React.useContext(FocusContext);
  if (context === undefined) {
    throw new Error("FocusContext not provided");
  }
  return context;
}

export function useInputElementFocus(): InputElementFocus {
  return getFocusContextOrThrow();
}

export function FocusContextProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [isInputElementInFocus, setIsInputElementInFocus] =
    useState<boolean>(false);
  return (
    <FocusContext.Provider
      value={{
        isInputElementInFocus,
        setIsInputElementInFocus,
      }}
    >
      {children}
    </FocusContext.Provider>
  );
}
