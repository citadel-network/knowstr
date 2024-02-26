import React, { useState } from "react";
import { Form } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { Button } from "./Ui";
import ModalForm from "./ModalForm";
import { useData } from "../DataContext";
import { DEFAULT_RELAYS, publishRelayMetadata } from "../nostr";
import { useApis } from "../Apis";
import { republishEvents } from "../executor";
import { FormControlWrapper } from "./FormControlWrapper";

type RelayButtonProps = {
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
};

function RelayButton({
  onClick,
  ariaLabel,
  children,
}: RelayButtonProps): JSX.Element {
  return (
    <Button className="btn ms-2" ariaLabel={ariaLabel} onClick={onClick}>
      {children}
    </Button>
  );
}

type EditableFormControlProps = {
  isEdit: boolean;
  setIsEdit: React.Dispatch<React.SetStateAction<boolean>>;
  onSave: (newRelay: string) => void;
  relay?: string;
  defaultValue?: string;
};

function EditableFormControl({
  isEdit,
  setIsEdit,
  onSave,
  relay,
  defaultValue,
}: EditableFormControlProps): JSX.Element {
  const startingInput = defaultValue || relay || "";
  const [inputValue, setInputValue] = useState<string>(startingInput);
  return (
    <>
      <FormControlWrapper
        name={`relay ${startingInput}`}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        disabled={!isEdit}
        className="ms-2 p-2"
        style={{ flexGrow: 1 }}
      />
      {isEdit && (
        <>
          <RelayButton
            ariaLabel="save edit relay"
            onClick={() => {
              onSave(inputValue);
              setIsEdit(false);
            }}
          >
            <span className="simple-icon-check" />
          </RelayButton>
          <RelayButton
            ariaLabel="undo edit relay"
            onClick={() => {
              if (relay) {
                onSave(relay);
              }
              setInputValue(defaultValue || relay || "");
              setIsEdit(false);
            }}
          >
            <span className="simple-icon-close" />
          </RelayButton>
        </>
      )}
    </>
  );
}

type RelayFormGroupProps = {
  relay: string;
  onDelete: () => void;
  onSave: (newRelay: string) => void;
};

function RelayFormGroup({
  relay,
  onDelete,
  onSave,
}: RelayFormGroupProps): JSX.Element {
  const [isEdit, setIsEdit] = useState<boolean>(false);

  return (
    <Form.Group className="d-flex align-items-center mb-2">
      <RelayButton
        ariaLabel={`remove ${relay}`}
        onClick={() => {
          setIsEdit(false);
          onDelete();
        }}
      >
        <span className="simple-icon-minus" />
      </RelayButton>

      <EditableFormControl
        isEdit={isEdit}
        setIsEdit={setIsEdit}
        onSave={onSave}
        relay={relay}
      />

      {!isEdit && (
        <RelayButton
          ariaLabel={`edit relay ${relay}`}
          onClick={() => setIsEdit(true)}
        >
          <span className="simple-icon-pencil" />
        </RelayButton>
      )}
    </Form.Group>
  );
}

type NewRelayFormGroupProps = {
  onSave: (newRelay: string) => void;
  defaultValue?: string;
};

function NewRelayFormGroup({
  onSave,
  defaultValue,
}: NewRelayFormGroupProps): JSX.Element {
  const [isEdit, setIsEdit] = useState<boolean>(false);

  return (
    <Form.Group className="d-flex align-items-center mb-2">
      <RelayButton ariaLabel="add new relay" onClick={() => setIsEdit(true)}>
        <span className="simple-icon-plus" />
      </RelayButton>

      {isEdit && (
        <EditableFormControl
          isEdit={isEdit}
          setIsEdit={setIsEdit}
          onSave={onSave}
          defaultValue={defaultValue}
        />
      )}
    </Form.Group>
  );
}

function getSuggestedRelay(
  relayState: Relays,
  suggestionRelays: Relays
): Relay | undefined {
  return suggestionRelays.find(
    (suggestedRelay) =>
      relayState.filter((r) => r.url === suggestedRelay.url).length === 0
  );
}

function mergeRelays(relays: Relays, relaysToMerge: Relays): Relays {
  const combinedRelays = [...relays, ...relaysToMerge];
  return combinedRelays.reduce((rdx: Relays, current: Relay): Relays => {
    if (!rdx.some((relay) => relay.url === current.url)) {
      return [...rdx, current];
    }
    return rdx;
  }, []);
}

export function EditRelays(): JSX.Element {
  const navigate = useNavigate();
  const { relayPool, finalizeEvent } = useApis();
  const { user, relays, sentEvents } = useData();
  const [relayState, setRelayState] = useState<Relays>(relays);

  const deleteRelay = (index: number): void => {
    setRelayState(
      relayState.filter((_, i) => {
        return i !== index;
      })
    );
  };
  const saveRelay = (newRelayUrl: string, index: number): void => {
    const newRelay = { url: newRelayUrl, read: true, write: true };
    if (index === relayState.length) {
      setRelayState(relayState.concat([newRelay]));
    } else {
      setRelayState(
        relayState.map((relay, i) => (index !== i ? relay : newRelay))
      );
    }
  };
  const submit = async (): Promise<void> => {
    // publish on old and new relays as well as default relays
    const allRelays = mergeRelays(
      DEFAULT_RELAYS,
      mergeRelays(relays, relayState)
    );
    await publishRelayMetadata(
      relayPool,
      user,
      relayState,
      allRelays,
      finalizeEvent
    );
    const newRelays = relayState.filter(
      (newrel) => !relays.some((r) => r.url === newrel.url)
    );
    if (newRelays.length > 0) {
      await republishEvents(relayPool, sentEvents, newRelays);
    }
    navigate("/");
  };
  return (
    <ModalForm
      submit={submit}
      onHide={() => navigate("/")}
      title="Set Nostr Relays"
    >
      {relayState.map((relay: Relay, index: number) => {
        const key = `relay${relay.url}`;
        return (
          <div key={key}>
            <RelayFormGroup
              relay={relay.url}
              onDelete={() => deleteRelay(index)}
              onSave={(newRelay) => {
                if (newRelay !== relay.url) {
                  saveRelay(newRelay, index);
                }
              }}
            />
          </div>
        );
      })}
      <NewRelayFormGroup
        defaultValue={getSuggestedRelay(relayState, DEFAULT_RELAYS)?.url}
        onSave={(newRelay) => saveRelay(newRelay, relayState.length)}
      />
    </ModalForm>
  );
}
