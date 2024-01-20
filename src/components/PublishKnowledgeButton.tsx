import React from "react";
import { usePublishData } from "../KnowledgeDataContext";
import { LoadingSpinnerButton } from "./LoadingSpinnerButton";

export function PublishKnowledgeButton(): JSX.Element | null {
  return null;
  /*
  const { hasUnpublishedData, publishKnowledgeData } = usePublishData();
  if (!hasUnpublishedData) {
    return null;
  }

  return (
    <LoadingSpinnerButton
      onClick={publishKnowledgeData}
      className="btn"
      ariaLabel="Save Knowledge"
    >
      <span className="simple-icon-cloud-upload d-block" />
    </LoadingSpinnerButton>
  );
   */
}
