import React from "react";
import { FormControl } from "react-bootstrap";
import { useInputElementFocus } from "../FocusContextProvider";

export function FormControlWrapper(
  props: React.ComponentProps<typeof FormControl>
): JSX.Element {
  const { setIsInputElementInFocus } = useInputElementFocus();
  const { onFocus, onBlur, ...otherProps } = props;
  return (
    <FormControl
      as="input"
      onFocus={(event) => {
        setIsInputElementInFocus(true);
        if (onFocus) {
          onFocus(event);
        }
      }}
      onBlur={(event) => {
        setIsInputElementInFocus(false);
        if (onBlur) {
          onBlur(event);
        }
      }}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...otherProps}
    />
  );
}

export function InputElementWrapper(
  props: React.InputHTMLAttributes<HTMLInputElement>
): JSX.Element {
  const { setIsInputElementInFocus } = useInputElementFocus();
  const { onFocus, onBlur, ...otherProps } = props;
  return (
    <input
      onFocus={(event) => {
        setIsInputElementInFocus(true);
        if (onFocus) {
          onFocus(event);
        }
      }}
      onBlur={(event) => {
        setIsInputElementInFocus(false);
        if (onBlur) {
          onBlur(event);
        }
      }}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...otherProps}
    />
  );
}
