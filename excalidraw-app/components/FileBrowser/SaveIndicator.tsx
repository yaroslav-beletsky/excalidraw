import React from "react";
import { useAtomValue } from "../../app-jotai";
import { saveStateAtom } from "../../github/atoms";

export const SaveIndicator: React.FC = () => {
  const saveState = useAtomValue(saveStateAtom);

  if (saveState.status === "idle") {
    return null;
  }

  const config: Record<string, { label: string; className: string }> = {
    saved: { label: "✓ Saved", className: "SaveIndicator--saved" },
    unsaved: { label: "● Unsaved", className: "SaveIndicator--unsaved" },
    saving: { label: "Saving...", className: "SaveIndicator--saving" },
    error: { label: "✗ Error", className: "SaveIndicator--error" },
    conflict: { label: "⚠ Conflict", className: "SaveIndicator--conflict" },
  };

  const { label, className } = config[saveState.status] ?? config.error;
  const errorMessage =
    saveState.status === "error" ? saveState.message : undefined;

  return (
    <span
      className={`SaveIndicator ${className}`}
      title={errorMessage}
    >
      {saveState.status === "saving" && (
        <span className="SaveIndicator__spinner" aria-hidden="true" />
      )}
      {saveState.status === "saving" ? "Saving..." : label}
    </span>
  );
};
