import React, { useState } from "react";
import { Card, InputGroup } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { Button } from "./Ui";
import ModalForm from "./ModalForm";
import { useData } from "../DataContext";
import { InputElementWrapper, pasteFromClipboard } from "./FormControlWrapper";
import { planPublishRelayMetadata, usePlanner } from "../planner";
import { useDefaultRelays } from "../NostrAuthContext";
import ErrorMessage from "./ErrorMessage";

export function mergeRelays(relays: Relays, relaysToMerge: Relays): Relays {
  const combinedRelays = [...relays, ...relaysToMerge];
  return combinedRelays.reduce((rdx: Relays, current: Relay): Relays => {
    if (!rdx.some((relay) => relay.url === current.url)) {
      return [...rdx, current];
    }
    return rdx;
  }, []);
}

function sanitizeRelayUrl(url: string): string | undefined {
  const trimmedUrl = url.trim();
  const noAddWS =
    trimmedUrl.startsWith("wss://") || trimmedUrl.startsWith("ws://");
  const urlWithWS = noAddWS ? trimmedUrl : `wss://${trimmedUrl}`;
  try {
    return new URL(urlWithWS).toString();
  } catch {
    return undefined;
  }
}

export function sanitizeRelays(relays: Array<Relay>): Array<Relay> {
  return relays
    .map((relay) => {
      const sanitizedRelayUrl = sanitizeRelayUrl(relay.url);
      return sanitizedRelayUrl
        ? {
            ...relay,
            url: sanitizedRelayUrl,
          }
        : undefined;
    })
    .filter((r) => r !== undefined) as Array<Relay>;
}

type ReadWriteButtonProps = {
  isPressed: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
};

function ReadWriteButton({
  isPressed,
  onClick,
  ariaLabel,
  children,
}: ReadWriteButtonProps): JSX.Element {
  return (
    <Button
      onClick={onClick}
      className={`btn font-size-small ${
        isPressed ? "pressed" : ""
      } m-1 mt-0 mb-2`}
      ariaLabel={ariaLabel}
    >
      {children}
    </Button>
  );
}

type DeleteRelayButtonProps = {
  onClick: () => void;
  ariaLabel: string;
};

function DeleteRelayButton({
  onClick,
  ariaLabel,
}: DeleteRelayButtonProps): JSX.Element {
  return (
    <Button
      onClick={onClick}
      className="btn font-size-small"
      ariaLabel={ariaLabel}
    >
      <span className="simple-icon-trash" />
    </Button>
  );
}

function AddRelayButton({
  onClick,
  ariaLabel,
}: DeleteRelayButtonProps): JSX.Element {
  return (
    <Button
      onClick={onClick}
      className="btn font-size-small"
      ariaLabel={ariaLabel}
    >
      <span className="simple-icon-plus" />
    </Button>
  );
}

type RelayCardProps = {
  className?: string;
  children: React.ReactNode;
};

function RelayCard({ className, children }: RelayCardProps): JSX.Element {
  return (
    <Card
      className={`flex-row-space-between p-3 m-2 mt-3 mb-3 border-strong ${
        className || ""
      }`}
    >
      {children}
    </Card>
  );
}

type RelayDetailsProps = {
  relay: Relay;
  onUpdate: (newRelay: Relay) => void;
  onDelete: () => void;
};

function RelayDetails({
  relay,
  onUpdate,
  onDelete,
}: RelayDetailsProps): JSX.Element {
  return (
    <RelayCard>
      <div>
        <div className="flex-row-start m-1 mt-2">{relay.url}</div>
        <div className="flex-row-start">
          <ReadWriteButton
            isPressed={relay.read}
            ariaLabel={
              relay.read
                ? `stop reading from relay ${relay.url}`
                : `start reading from relay ${relay.url}`
            }
            onClick={() => {
              onUpdate({ ...relay, read: !relay.read });
            }}
          >
            Read
          </ReadWriteButton>
          <ReadWriteButton
            isPressed={relay.write}
            ariaLabel={
              relay.write
                ? `stop writing to relay ${relay.url}`
                : `start writing to relay ${relay.url}`
            }
            onClick={() => {
              onUpdate({ ...relay, write: !relay.write });
            }}
          >
            Write
          </ReadWriteButton>
        </div>
      </div>
      <div className="flex-col-center">
        <DeleteRelayButton
          onClick={onDelete}
          ariaLabel={`delete relay ${relay.url}`}
        />
      </div>
    </RelayCard>
  );
}

function SuggestedRelayDetails({
  relay,
  onUpdate,
}: Omit<RelayDetailsProps, "onDelete">): JSX.Element {
  return (
    <RelayCard className="black-dimmed">
      <div className="flex-row-start m-1 mt-2">{relay.url}</div>
      <div className="flex-col-center">
        <AddRelayButton
          onClick={() => onUpdate(relay)}
          ariaLabel={`add relay ${relay.url}`}
        />
      </div>
    </RelayCard>
  );
}

type NewRelayProps = {
  onSave: (newRelay: Relay) => void;
};

function NewRelay({ onSave }: NewRelayProps): JSX.Element {
  const [input, setInput] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const changedInput = e.target.value;
    if (changedInput === input) {
      return;
    }
    setInput(!changedInput ? undefined : changedInput);
  };

  const onSubmit = (): void => {
    if (!input) {
      setError("Undefined relay");
      return;
    }
    const sanitizedInput = sanitizeRelayUrl(input);
    if (!sanitizedInput) {
      setError("Invalid relay address");
      return;
    }
    onSave({ url: sanitizedInput, read: true, write: true });
    const inputElement = document.querySelector(
      'input[aria-label="add new relay"]'
    );
    if (inputElement) {
      // eslint-disable-next-line functional/immutable-data
      (inputElement as HTMLInputElement).value = "";
    }
    setInput(undefined);
  };

  const inputElementAriaLabel = "add new relay";

  return (
    <RelayCard className="black-dimmed">
      <div className="m-1 mt-2 w-90">
        <InputGroup>
          <div style={{ position: "relative", flexGrow: 1 }}>
            <InputElementWrapper
              aria-label={inputElementAriaLabel}
              onChange={onChange}
              placeholder="wss://"
              className="p-2 w-100"
            />
            <div
              style={{
                position: "absolute",
                right: "10px",
                top: "15%",
              }}
            >
              <Button
                className="btn-borderless background-transparent"
                onClick={() =>
                  pasteFromClipboard(inputElementAriaLabel, setInput)
                }
              >
                <span className="iconsminds-file-clipboard" />
              </Button>
            </div>
          </div>
        </InputGroup>
        <div className="m-2">
          <ErrorMessage error={error} setError={setError} />
        </div>
      </div>
      {input !== undefined && (
        <div className="flex-col-center">
          <AddRelayButton
            onClick={onSubmit}
            ariaLabel={`add new relay ${input}`}
          />
        </div>
      )}
    </RelayCard>
  );
}

export function EditRelays(): JSX.Element {
  const navigate = useNavigate();
  const { createPlan, executePlan } = usePlanner();
  const defaultRelays = useDefaultRelays();
  const { relays } = useData();
  const suggestedRelays = defaultRelays.reduce((rdx, rel) => {
    return relays.some((r) => r.url === rel.url) ? rdx : [...rdx, rel];
  }, [] as Relays);
  const [relayState, setRelayState] = useState<{
    myRelays: Relays;
    suggested: Relays;
  }>({ myRelays: relays, suggested: suggestedRelays });

  const deleteRelay = (index: number): void => {
    setRelayState({
      ...relayState,
      myRelays: relayState.myRelays.filter((_, i) => {
        return i !== index;
      }),
    });
  };

  const updateRelay = (updatedRelay: Relay, index: number): void => {
    setRelayState({
      ...relayState,
      myRelays: relayState.myRelays.map((relay, i) =>
        index !== i ? relay : updatedRelay
      ),
    });
  };

  const addRelay = (newRelay: Relay): void => {
    setRelayState({
      myRelays: mergeRelays(relayState.myRelays, [newRelay]),
      suggested: relayState.suggested.filter((r) => r.url !== newRelay.url),
    });
  };

  const submit = async (): Promise<void> => {
    // publish on old and new relays as well as default relays
    const allRelays = mergeRelays(
      defaultRelays,
      mergeRelays(relays, relayState.myRelays)
    );
    const plan = planPublishRelayMetadata(
      { ...createPlan(), relays: allRelays },
      relayState.myRelays
    );
    await executePlan(plan);
    navigate("/");
  };

  return (
    <ModalForm
      submit={submit}
      onHide={() => navigate("/")}
      title="Edit Nostr Relays"
    >
      <div className="scroll">
        {relayState.myRelays.map((relay: Relay, index: number) => {
          const key = `relay ${relay.url}`;
          return (
            <div key={key}>
              <RelayDetails
                relay={relay}
                onDelete={() => deleteRelay(index)}
                onUpdate={(newRelay) => {
                  if (newRelay !== relay) {
                    updateRelay(newRelay, index);
                  }
                }}
              />
            </div>
          );
        })}
        {relayState.suggested.map((suggestedRelay: Relay) => {
          const key = `suggested relay ${suggestedRelay.url}`;
          return (
            <div key={key}>
              <SuggestedRelayDetails
                relay={suggestedRelay}
                onUpdate={(newRelay) => addRelay(newRelay)}
              />
            </div>
          );
        })}
        <NewRelay onSave={(newRelay) => addRelay(newRelay)} />
      </div>
    </ModalForm>
  );
}
