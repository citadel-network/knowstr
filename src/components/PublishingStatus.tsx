import React, { useState } from "react";
import { Dropdown, Spinner, ProgressBar, Collapse } from "react-bootstrap";
import { useMediaQuery } from "react-responsive";
import { useData } from "../DataContext";
import { IS_MOBILE } from "./responsive";

function getStatusCount(status: Array<PublishStatus>, type: string): number {
  return status.filter((s) => s.status === type).length;
}
function getLastRejectedReason(
  status: Array<PublishStatus>
): string | undefined {
  const lastRejected = status
    .slice()
    .reverse()
    .find((s) => s.status === "rejected");
  return lastRejected ? lastRejected.reason : undefined;
}

function RelayPublishStatus({
  status,
  relayUrl,
}: {
  status: Array<PublishStatus>;
  relayUrl: string;
}): JSX.Element {
  const isMobile = useMediaQuery(IS_MOBILE);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const numberFulfilled = getStatusCount(status, "fulfilled");
  const numberRejected = getStatusCount(status, "rejected");
  const totalNumber = numberFulfilled + numberRejected;
  const percentage = Math.round((numberFulfilled / totalNumber) * 100);
  const isWarning = percentage < 80;
  const warningVariant = percentage < 50 ? "danger" : "warning";
  const lastRejectedReason = getLastRejectedReason(status);
  return (
    <div style={{ maxWidth: "100vw" }}>
      <Dropdown.Divider />
      <Dropdown.Item tabIndex={0}>
        <div
          role="button"
          className="flex-row-space-between"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            setShowDetails(!showDetails);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }
          }}
        >
          <div className="me-2">
            <div className="bold break-word">{`Relay ${relayUrl}:`}</div>
            <ProgressBar
              now={percentage}
              label={`${percentage}%`}
              variant={isWarning ? warningVariant : "success"}
              style={{
                width: "30rem",
                maxWidth: isMobile ? "70vw" : "30rem",
                height: "1.5rem",
              }}
            />
            {showDetails && (
              <Collapse in={showDetails}>
                <div className="mt-1">
                  {totalNumber > 0
                    ? `${
                        totalNumber === 1
                          ? `The last event ${
                              numberFulfilled === 1 ? "has" : "has not"
                            }`
                          : `${numberFulfilled} of the last ${totalNumber} events have`
                      } been published on this relay`
                    : `No events were attempted to be published on this relay`}
                </div>
              </Collapse>
            )}
            {showDetails && lastRejectedReason && (
              <div
                className="break-word"
                style={{ maxWidth: isMobile ? "70vw" : "30rem" }}
              >
                {`The last event was not published because: ${lastRejectedReason}`}
              </div>
            )}
          </div>
          <div className="ms-2 flex-row-center align-center icon-large">
            <div
              className={
                isWarning
                  ? "simple-icon-exclamation danger"
                  : "simple-icon-check success"
              }
            />
          </div>
        </div>
      </Dropdown.Item>
    </div>
  );
}

export function PublishingStatus(): JSX.Element | null {
  const { publishResults, loadingResults } = useData();
  if (loadingResults === true) {
    return (
      <div style={{ paddingTop: "6px", paddingBottom: "4px" }}>
        <Spinner animation="border" role="status" />
      </div>
    );
  }
  if (publishResults.size === 0) {
    return null;
  }

  return (
    <Dropdown>
      <Dropdown.Toggle
        as="button"
        id="publishing-status-dropdown"
        key="publishing-status-dropdown"
        className="btn"
        style={{ paddingTop: "6px", paddingBottom: "4px" }}
        aria-label="publishing status"
        tabIndex={0}
      >
        <span className="simple-icon-info" />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Item key="publishing-status-header" className="black-muted">
          <div className="project-selection">
            <h2>Publishing Status</h2>
          </div>
        </Dropdown.Item>
        {publishResults
          .map((status, relayUrl) => {
            return (
              <RelayPublishStatus
                status={status}
                relayUrl={relayUrl}
                // eslint-disable-next-line react/no-array-index-key
                key={`publishing-status ${relayUrl}`}
              />
            );
          })
          .valueSeq()}
      </Dropdown.Menu>
    </Dropdown>
  );
}
