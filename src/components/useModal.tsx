import { useState } from "react";

type useModalReturnValue = {
  openModal: () => void;
  closeModal: () => void;
  isOpen: boolean;
};
function useModal(initOpen = false): useModalReturnValue {
  const [showModal, setShowModal] = useState<boolean>(initOpen);
  const openModal = (): void => {
    setShowModal(true);
  };
  const closeModal = (): void => {
    setShowModal(false);
  };
  return {
    openModal,
    closeModal,
    isOpen: showModal,
  };
}

export default useModal;
