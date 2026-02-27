import React from "react";
import { useAtomValue } from "../../app-jotai";
import { saveStateAtom } from "../../github/atoms";

import "./SaveIndicator.scss";

interface SaveIndicatorProps {
  onSave?: () => void;
}

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SaveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export const SaveIndicator: React.FC<SaveIndicatorProps> = ({ onSave }) => {
  const saveState = useAtomValue(saveStateAtom);

  if (saveState.status === "idle") {
    return null;
  }

  const isClickable =
    onSave && (saveState.status === "unsaved" || saveState.status === "error");

  const errorMessage =
    saveState.status === "error" ? saveState.message : undefined;

  return (
    <button
      type="button"
      className={`SaveIndicator SaveIndicator--${saveState.status}`}
      title={
        errorMessage ??
        (isClickable ? "Save now (Ctrl+S)" : undefined)
      }
      onClick={isClickable ? onSave : undefined}
      disabled={!isClickable}
    >
      {saveState.status === "saving" && (
        <span className="SaveIndicator__spinner" />
      )}
      {saveState.status === "saved" && <CheckIcon />}
      {saveState.status === "unsaved" && <SaveIcon />}
      {(saveState.status === "error" || saveState.status === "conflict") && (
        <AlertIcon />
      )}
      <span className="SaveIndicator__label">
        {saveState.status === "saved" && "Saved"}
        {saveState.status === "unsaved" && "Save"}
        {saveState.status === "saving" && "Saving"}
        {saveState.status === "error" && "Error"}
        {saveState.status === "conflict" && "Conflict"}
      </span>
    </button>
  );
};
