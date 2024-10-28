type OnValidateProps = {
  event: React.MouseEvent<HTMLElement>;
  next: () => void;
};

type OnValidate = ({ event, next }: OnValidateProps) => void;

type ValidateHandlerProps = {
  setError: (error: string | null) => void;
  validate: (form: HTMLFormElement) => void;
};

export function createValidateHandler({
  setError,
  validate,
}: ValidateHandlerProps): OnValidate {
  const onValidate = ({ event, next }: OnValidateProps): void => {
    event.preventDefault();
    event.stopPropagation();
    const form = event.currentTarget.parentElement?.parentElement?.parentElement
      ?.parentElement as HTMLFormElement;
    form.reportValidity();
    if (form.reportValidity() === false) {
      return;
    }
    try {
      validate(form);
    } catch (err) {
      const ex: Error = err as Error;
      setError(ex.message);
      return;
    }
    next();
  };
  return onValidate;
}
