import React from "react";
import { useMediaQuery } from "react-responsive";
import { SelectVersions, isShowVersions } from "./SelectVersions";
import {
  ToggleEditing,
  ToggleMultiselect,
  useTemporaryView,
} from "./TemporaryViewContext";
import { DisconnectBtn } from "./DisconnectBtn";
import { SelectRelations } from "./SelectRelations";
import { ChangeColumnWidth } from "./ChangeColumnWidth";
import { useNode, useViewKey } from "../ViewContext";
import { IS_MOBILE } from "./responsive";

export function ColumnMenu(): JSX.Element {
  const temporaryView = useTemporaryView();
  const viewKey = useViewKey();
  const isMultiSelectToggled = temporaryView.multiselectBtns.has(viewKey);
  return (
    <div className="flex-row-space-between font-size-big">
      <div className="flex-row-start p-1">
        <ToggleMultiselect />
        <div className="vertical-line ms-2 me-2" />
        {!isMultiSelectToggled && (
          <div className="menu-layout">
            <SelectRelations />
            <SelectVersions />
            <ToggleEditing />
          </div>
        )}
      </div>
      <div className="flex-row-end p-1">
        {isMultiSelectToggled ? <DisconnectBtn /> : <ChangeColumnWidth />}
      </div>
    </div>
  );
}

export function DetailViewMenu(): JSX.Element {
  const temporaryView = useTemporaryView();
  const viewKey = useViewKey();
  const isMultiSelectToggled = temporaryView.multiselectBtns.has(viewKey);
  return (
    <div className="flex-row-space-between font-size-big">
      <div className="flex-row-start p-1">
        <ToggleMultiselect />
        <div className="vertical-line ms-2 me-2" />
        {!isMultiSelectToggled && (
          <div className="menu-layout">
            <SelectRelations />
            <SelectVersions />
            <ToggleEditing />
          </div>
        )}
      </div>
      {isMultiSelectToggled && (
        <div className="flex-row-end p-1">
          <DisconnectBtn />
        </div>
      )}
    </div>
  );
}

function useIsActionable(): boolean {
  const [repo, view] = useNode();
  if (!repo) {
    return false;
  }
  const node = getNode(repo, view.branch);
  const relationCount = node.relations.reduce(
    (counter, relations) => counter + relations.size,
    0
  );
  const [showVersions] = isShowVersions(repo, view);
  return relationCount > 0 || showVersions;
}

function ReadonlyMenu(): JSX.Element | null {
  if (!useIsActionable()) {
    return null;
  }
  return (
    <div className="menu-layout w-100" style={{ height: "min-content" }}>
      <SelectRelations readonly />
      <SelectVersions readonly />
    </div>
  );
}

export function NodeMenu(): JSX.Element | null {
  // show ReadonlyMenu on mobile because there is no tree view
  const isMobile = useMediaQuery(IS_MOBILE);
  if (isMobile) {
    return <ReadonlyMenu />;
  }
  return (
    <div className="menu-layout w-100" style={{ height: "min-content" }}>
      <SelectRelations />
      <SelectVersions />
      <ToggleEditing />
    </div>
  );
}
