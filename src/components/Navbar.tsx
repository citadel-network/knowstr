import React, { useState } from "react";
import { Alert, Dropdown, Modal } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import { NotificationCenter } from "../commons/NotificationCenter";
import { SelectWorkspaces } from "./SelectWorkspaces";
import { IS_MOBILE } from "./responsive";
import { DeleteWorkspace } from "./DeleteNode";
import { useData } from "../DataContext";
import { planPublishSettings, usePlanner } from "../planner";
import { PublishingStatusWrapper } from "./PublishingStatusWrapper";
import { SignInMenuBtn } from "../SignIn";
import { isUserLoggedIn } from "../NostrAuthContext";
import { useProjectContext } from "../ProjectContext";
import { CurrentWorkspaceTitle } from "../WorkspaceContext";

type NavBarProps = {
  logout: () => void;
};

function Deedsats(): JSX.Element | null {
  const { projectID } = useProjectContext();
  const isProject = projectID !== undefined;
  if (!isProject) {
    return null;
  }
  return <span>Deedsats | </span>;
}

function ProjectName(): JSX.Element | null {
  const { projectID, project } = useProjectContext();
  const isProject = projectID !== undefined;
  if (!isProject) {
    return null;
  }
  if (!project) {
    return (
      <>
        <span className="spinner-border spinner-navbar" /> |{" "}
      </>
    );
  }
  return <span>{project.text} | </span>;
}

function Title(): JSX.Element | null {
  const isMobile = useMediaQuery(IS_MOBILE);
  const { projectID } = useProjectContext();
  const isProject = projectID !== undefined;
  return (
    <div className="navbar-title d-flex align-center">
      <div className={`${isProject ? "bitcoin-orange" : ""} workspace-title`}>
        {!isMobile && <Deedsats />}
        <ProjectName />
        <CurrentWorkspaceTitle />
      </div>
      {!isMobile && <DeleteWorkspace />}
    </div>
  );
}

export function NavBar({ logout }: NavBarProps): JSX.Element {
  const navigate = useNavigate();
  const { createPlan, executePlan } = usePlanner();
  const [isError, setIsError] = useState<boolean>(false);
  const { settings, user } = useData();
  const isBionic = settings.bionicReading;
  const { projectID } = useProjectContext();
  const isProject = projectID !== undefined;
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
  const isLoggedIn = isUserLoggedIn(user);

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
      <nav className={`${isProject ? "navbar-project" : ""} navbar`}>
        <div className="navbar-left d-flex align-center">
          <SelectWorkspaces />
        </div>
        <Title />
        <div className="navbar-right">
          <PublishingStatusWrapper />
          <SignInMenuBtn />
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
              <DeleteWorkspace as="item" />
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
              {isLoggedIn && (
                <Dropdown.Item
                  className="d-flex workspace-selection"
                  onClick={logout}
                  aria-label="logout"
                  tabIndex={0}
                >
                  <span className="simple-icon-logout d-block dropdown-item-icon" />
                  <div className="workspace-selection-text">Log Out</div>
                </Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </nav>
    </>
  );
}
