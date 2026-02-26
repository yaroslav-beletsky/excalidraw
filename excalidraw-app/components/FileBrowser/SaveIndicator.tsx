import React from "react";
import { useAtomValue } from "../../app-jotai";
import { saveStateAtom } from "../../github/atoms";

interface SaveIndicatorProps {
  onSave?: () => void;
}

export const SaveIndicator: React.FC<SaveIndicatorProps> = ({ onSave }) => {
  const saveState = useAtomValue(saveStateAtom);

  if (saveState.status === "idle") {
    return null;
  }

  const config: Record<string, { label: string; className: string }> = {
    saved: { label: "Saved", className: "SaveIndicator--saved" },
    unsaved: { label: "Unsaved", className: "SaveIndicator--unsaved" },
    saving: { label: "Saving...", className: "SaveIndicator--saving" },
    error: { label: "Error", className: "SaveIndicator--error" },
    conflict: { label: "Conflict", className: "SaveIndicator--conflict" },
  };

  const { label, className } = config[saveState.status] ?? config.error;
  const errorMessage =
    saveState.status === "error" ? saveState.message : undefined;

  const isClickable =
    onSave && (saveState.status === "unsaved" || saveState.status === "error");

  return (
    <button
      type="button"
      className={`SaveIndicator ${className}`}
      title={
        errorMessage ??
        (isClickable ? "Click to save (Ctrl+S)" : undefined)
      }
      onClick={isClickable ? onSave : undefined}
      style={{
        cursor: isClickable ? "pointer" : "default",
        background: "none",
        border: "none",
        padding: "2px 6px",
        borderRadius: "4px",
      }}
    >
      {saveState.status === "saving" && (
        <span className="SaveIndicator__spinner" aria-hidden="true" />
      )}
      {label}
    </button>
  );
};
