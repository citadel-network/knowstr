import React from "react";
import ReactQuill, { ReactQuillProps } from "react-quill";
import { useInputElementFocus } from "citadel-commons";

export const ReactQuillWrapper = React.forwardRef(
  (props: ReactQuillProps, ref: React.ForwardedRef<ReactQuill>) => {
    const { setIsInputElementInFocus } = useInputElementFocus();
    const { onFocus, onBlur, ...otherProps } = props;
    return (
      <ReactQuill
        theme="bubble"
        formats={[]}
        modules={{ toolbar: false }}
        scrollingContainer="scrolling-container"
        ref={ref}
        onFocus={(event, source, editor) => {
          setIsInputElementInFocus(true);
          if (onFocus) {
            onFocus(event, source, editor);
          }
        }}
        onBlur={(event, source, editor) => {
          setIsInputElementInFocus(false);
          if (onBlur) {
            onBlur(event, source, editor);
          }
        }}
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...otherProps}
      />
    );
  }
);
