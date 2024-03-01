import React, { useState } from "react";
import { Alert, Dropdown, Modal } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import { SelectWorkspaces } from "./SelectWorkspaces";
import { useWorkspace } from "../KnowledgeDataContext";
import { IS_MOBILE } from "./responsive";
import { DeleteNode } from "./DeleteNode";
import { NotificationCenter } from "./NotificationCenter";
import { useData } from "../DataContext";
import { planPublishSettings, usePlanner } from "../planner";
import { PublishingStatus } from "./PublishingStatus";

type NavBarProps = {
  logout: () => void;
};

export function NavBar({ logout }: NavBarProps): JSX.Element {
  const title = useWorkspace();
  const navigate = useNavigate();
  const { createPlan, executePlan } = usePlanner();
  const [isError, setIsError] = useState<boolean>(false);
  const { settings } = useData();
  const isBionic = settings.bionicReading;
  const onToggleBionic = async (): Promise<void> => {
    try {
      await executePlan(
        planPublishSettings(createPlan(), {
          ...settings,
          bionicReading: !isBionic,
        })
      );
    } catch (e) {
      setIsError(true);
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  const isMobile = useMediaQuery(IS_MOBILE);

  return (
    <>
      <Modal show={isError} onHide={() => setIsError(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Error</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="danger">
            {`Couldn't turn ${
              isBionic ? "off" : "on"
            } Bionic Reading. Please try
        again later.`}
          </Alert>
        </Modal.Body>
      </Modal>
      <nav className="navbar">
        <div className="navbar-left d-flex align-center">
          <SelectWorkspaces />
        </div>
        {!isMobile && (
          <div className="navbar-title d-flex align-center">
            <div className="workspace-title">{title}</div>
            <DeleteNode />
          </div>
        )}
        <div className="navbar-right">
          <PublishingStatus />
          <NotificationCenter />
          <Dropdown className="options-dropdown">
            <Dropdown.Toggle
              as="button"
              className="btn"
              aria-label="open menu"
              tabIndex={0}
            >
              <span className="simple-icon-options-vertical" />
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <DeleteNode as="item" />
              <Dropdown.Item
                className="d-flex workspace-selection"
                onClick={() => navigate("/profile")}
                aria-label="show profile"
                tabIndex={0}
              >
                <span className="simple-icon-user d-block dropdown-item-icon" />
                <div className="workspace-selection-text">Profile</div>
              </Dropdown.Item>
              <Dropdown.Item
                className="d-flex workspace-selection"
                onClick={() => navigate("/follow")}
                aria-label="follow user"
                tabIndex={0}
              >
                <span className="simple-icon-user-follow d-block dropdown-item-icon" />
                <div className="workspace-selection-text">Follow User</div>
              </Dropdown.Item>
              <Dropdown.Item
                className="d-flex workspace-selection"
                onClick={() => navigate("/relays")}
                aria-label="edit relays"
                tabIndex={0}
              >
                <span className="icon-nostr-logo d-block dropdown-item-icon" />
                <div className="workspace-selection-text">Relays</div>
              </Dropdown.Item>
              <Dropdown.Item
                className="d-flex workspace-selection"
                onClick={onToggleBionic}
                aria-label={`switch bionic reading ${isBionic ? "off" : "on"}`}
                tabIndex={0}
              >
                <span
                  className={`simple-icon-eyeglass d-block dropdown-item-icon ${
                    isBionic ? "bold" : ""
                  }`}
                />
                <div className="workspace-selection-text">
                  Turn {isBionic ? "off" : "on"} Bionic Reading
                </div>
              </Dropdown.Item>
              <Dropdown.Item
                className="d-flex workspace-selection"
                onClick={logout}
                aria-label="logout"
                tabIndex={0}
              >
                <span className="simple-icon-logout d-block dropdown-item-icon" />
                <div className="workspace-selection-text">Log Out</div>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </nav>
    </>
  );
}
