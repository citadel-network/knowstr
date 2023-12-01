import React, { useState } from "react";
import { OrderedSet, Set } from "immutable";
import { Selectbox } from "./Ui";
import {
  parseViewPath,
  useViewKey,
  getParentKey,
  useRepo,
  useParentRepo,
  useRelationIndex,
} from "../ViewContext";
import { useGetNodeText } from "../KnowledgeDataContext";
import { getNode } from "../knowledge";
import { getRelations } from "../connections";

type MultiSelectionState = {
  selection: OrderedSet<string>;
  multiselectBtns: Set<string>;
};

type MultiSelection = MultiSelectionState & {
  setState: (multiselectionState: MultiSelectionState) => void;
};

type EditingState = {
  editingViews: Set<string>;
};

type Editing = EditingState & {
  setEditingState: (editingState: EditingState) => void;
};

type EditorOpenState = {
  editorOpenViews: Set<string>;
};

type EditorOpen = EditorOpenState & {
  setEditorOpenState: (editorOpenState: EditorOpenState) => void;
};

type TemporaryView = MultiSelection & Editing & EditorOpen;

type SetSelected = (selected: boolean) => void;
type FindSelectedByPostfix = (postfix: string) => Set<string>;
type DeselectByPostfix = (postfix: string) => void;

const TemporaryViewContext = React.createContext<TemporaryView | undefined>(
  undefined
);

function getTemporaryViewContextOrThrow(): TemporaryView {
  const context = React.useContext(TemporaryViewContext);
  if (context === undefined) {
    throw new Error("TemporaryViewContext not provided");
  }
  return context;
}

export function useTemporaryView(): TemporaryView {
  return getTemporaryViewContextOrThrow();
}

function useSetSelected(): SetSelected {
  const { selection, setState, multiselectBtns } = useTemporaryView();
  const viewKey = useViewKey();
  return (selected: boolean): void => {
    if (!selected) {
      setState({ selection: selection.remove(viewKey), multiselectBtns });
    } else {
      setState({ selection: selection.add(viewKey), multiselectBtns });
    }
  };
}

export function useIsSelected(): boolean {
  const { selection } = useTemporaryView();
  const viewKey = useViewKey();
  return selection.contains(viewKey);
}

function getSelectedInView(
  selection: OrderedSet<string>,
  viewKey: string
): OrderedSet<string> {
  return selection.filter((sel) => sel.startsWith(viewKey));
}

export function getSelectedIndices(
  selection: OrderedSet<string>,
  viewKey: string
): OrderedSet<number> {
  return getSelectedInView(selection, viewKey)
    .map((key) => parseViewPath(key).indexStack.last(undefined))
    .filter((n) => n !== undefined) as OrderedSet<number>;
}

export function useSelectedIndices(): OrderedSet<number> {
  const { selection } = useTemporaryView();
  const viewKey = useViewKey();
  return getSelectedIndices(selection, viewKey);
}

export function useGetSelectedInView(): FindSelectedByPostfix {
  const { selection } = useTemporaryView();
  return (postfix) => getSelectedInView(selection, postfix);
}

export function deselectAllChildren(
  selection: OrderedSet<string>,
  viewKey: string
): OrderedSet<string> {
  return selection.filterNot((sel) => sel.startsWith(viewKey));
}

export function useDeselectAllInView(): DeselectByPostfix {
  const { selection, setState, multiselectBtns } = useTemporaryView();
  return (viewKey) =>
    setState({
      selection: deselectAllChildren(selection, viewKey),
      multiselectBtns,
    });
}

function isMultiselectBtnOn(
  multiselectBtns: Set<string>,
  viewKey: string
): boolean {
  return multiselectBtns.has(viewKey);
}

export function useIsParentMultiselectBtnOn(): boolean {
  const { multiselectBtns } = useTemporaryView();
  const viewKey = useViewKey();
  return isMultiselectBtnOn(multiselectBtns, getParentKey(viewKey));
}

export function switchOffMultiselect(
  multiselectBtns: Set<string>,
  selection: OrderedSet<string>,
  viewKey: string
): MultiSelectionState {
  return {
    selection: deselectAllChildren(selection, viewKey),
    multiselectBtns: multiselectBtns.remove(viewKey),
  };
}

function toggleMultiselect(
  multiselectBtns: Set<string>,
  selection: OrderedSet<string>,
  viewKey: string
): MultiSelectionState {
  return {
    selection: deselectAllChildren(selection, viewKey),
    multiselectBtns: isMultiselectBtnOn(multiselectBtns, viewKey)
      ? multiselectBtns.remove(viewKey)
      : multiselectBtns.add(viewKey),
  };
}

export function ToggleMultiselect(): JSX.Element {
  const [repo, view] = useRepo();
  const getNodeText = useGetNodeText();
  const ariaLabel = repo
    ? `toggle multiselect ${getNodeText(getNode(repo, view.branch))}`
    : undefined;
  const { selection, setState, multiselectBtns } = useTemporaryView();
  const viewKey = useViewKey();
  const onClick = (): void =>
    setState(toggleMultiselect(multiselectBtns, selection, viewKey));

  return (
    <button
      type="button"
      className="btn btn-borderless"
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <span className="iconsminds-check" />
    </button>
  );
}

function isEditingOn(editingViews: Set<string>, viewKey: string): boolean {
  return editingViews.has(viewKey);
}

export function useIsEditingOn(): boolean {
  const { editingViews } = useTemporaryView();
  const viewKey = useViewKey();
  return isEditingOn(editingViews, viewKey);
}

export function toggleEditing(
  editingViews: Set<string>,
  viewKey: string
): EditingState {
  return {
    editingViews: isEditingOn(editingViews, viewKey)
      ? editingViews.remove(viewKey)
      : editingViews.add(viewKey),
  };
}

export function ToggleEditing(): JSX.Element {
  const [repo, view] = useRepo();
  const getNodeText = useGetNodeText();
  const ariaLabel = repo
    ? `edit ${getNodeText(getNode(repo, view.branch))}`
    : undefined;
  const { editingViews, setEditingState } = useTemporaryView();
  const viewKey = useViewKey();
  const onClick = (): void =>
    setEditingState(toggleEditing(editingViews, viewKey));

  return (
    <button
      type="button"
      className="btn btn-borderless"
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <span className="iconsminds-pen-2" />
    </button>
  );
}

function isEditorOpen(editorOpenViews: Set<string>, viewKey: string): boolean {
  return editorOpenViews.has(viewKey);
}

export function useIsEditorOpen(): boolean {
  const { editorOpenViews } = useTemporaryView();
  const viewKey = useViewKey();
  return isEditorOpen(editorOpenViews, viewKey);
}

export function closeEditor(
  editorOpenViews: Set<string>,
  viewKey: string
): EditorOpenState {
  return {
    editorOpenViews: isEditorOpen(editorOpenViews, viewKey)
      ? editorOpenViews.remove(viewKey)
      : editorOpenViews,
  };
}

export function openEditor(
  editorOpenViews: Set<string>,
  viewKey: string
): EditorOpenState {
  return {
    editorOpenViews: !isEditorOpen(editorOpenViews, viewKey)
      ? editorOpenViews.add(viewKey)
      : editorOpenViews,
  };
}

export function TemporaryViewProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [multiselectState, setMultiselectState] = useState<MultiSelectionState>(
    {
      multiselectBtns: Set<string>(),
      selection: OrderedSet<string>(),
    }
  );
  const [isEditingState, setEditingState] = useState<EditingState>({
    editingViews: Set<string>(),
  });
  const [isEditorOpenState, setEditorOpenState] = useState<EditorOpenState>({
    editorOpenViews: Set<string>(),
  });
  return (
    <TemporaryViewContext.Provider
      value={{
        multiselectBtns: multiselectState.multiselectBtns,
        selection: multiselectState.selection,
        setState: setMultiselectState,
        editingViews: isEditingState.editingViews,
        setEditingState,
        editorOpenViews: isEditorOpenState.editorOpenViews,
        setEditorOpenState,
      }}
    >
      {children}
    </TemporaryViewContext.Provider>
  );
}

export function NodeSelectbox(): JSX.Element | null {
  const [repo, view] = useRepo();
  const getNodeText = useGetNodeText();
  const [parentRepo, parentView] = useParentRepo();
  const relationIndex = useRelationIndex();
  const checked = useIsSelected();
  const setSelected = useSetSelected();
  const isSubjectNode =
    parentRepo &&
    relationIndex !== undefined &&
    relationIndex >=
      getRelations(
        getNode(parentRepo, parentView.branch),
        parentView.relationType
      ).size;

  const ariaLabel = repo
    ? `${checked ? "deselect" : "select"} ${getNodeText(
        getNode(repo, view.branch)
      )}`
    : undefined;

  if (isSubjectNode) {
    return null;
  }
  return (
    <Selectbox
      checked={checked}
      setSelected={setSelected}
      ariaLabel={ariaLabel}
    />
  );
}
