import React from "react";
import { useNavigate } from "react-router-dom";
import { Dropdown, Spinner } from "react-bootstrap";
import { useData } from "../DataContext";

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
  const navigate = useNavigate();
  const numberFulfilled = getStatusCount(status, "fulfilled");
  const numberRejected = getStatusCount(status, "rejected");
  const totalNumber = numberFulfilled + numberRejected;
  const percentage = Math.round((numberFulfilled / totalNumber) * 100);
  const isWarning = percentage < 50;
  const lastRejectedReason = getLastRejectedReason(status);
  return (
    <>
      <Dropdown.Divider />
      <Dropdown.Item tabIndex={0} onClick={() => navigate("/relays")}>
        <div className="flex-row-space-between">
          <div className="me-2">
            <div className="bold">{`Relay ${relayUrl}:`}</div>
            <div className="mt-1">
              {totalNumber > 0
                ? `${
                    totalNumber === 1
                      ? `The last event ${
                          numberFulfilled === 1 ? "could" : "could not"
                        }`
                      : `${percentage}% of the last ${totalNumber} events could`
                  } be published on this relay`
                : `No events were attempted to be published on this relay`}
            </div>
            {lastRejectedReason && (
              <div>
                {`The last event could not be published because: ${lastRejectedReason}`}
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
    </>
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
          <div className="bold">
            <h3>Publishing Status</h3>
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
