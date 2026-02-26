import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

import { sanitizeFilename } from "../github/sanitize";
import { useDraws } from "../github/useDraws";

interface NewDiagramDialogProps {
  open: boolean;
  onClose: () => void;
  saveAsContent?: string;
  saveAsCurrentName?: string;
}

const EMPTY_EXCALIDRAW = JSON.stringify({
  type: "excalidraw",
  version: 2,
  source: "inspark-draw",
  elements: [],
  appState: { gridSize: null, viewBackgroundColor: "#ffffff" },
  files: {},
});

/**
 * A portal container in document.body that mirrors the .excalidraw theme classes
 * so that all CSS variables (--text-primary-color, --island-bg-color, etc.) resolve
 * correctly regardless of whether the caller is inside a tunnel-rat portal or sidebar.
 */
function useThemedPortalContainer(active: boolean) {
  const divRef = useRef<HTMLDivElement | null>(null);

  if (!divRef.current) {
    divRef.current = document.createElement("div");
  }

  useLayoutEffect(() => {
    const div = divRef.current!;
    // Sync theme from the live .excalidraw element in the DOM
    const sourceEl = document.querySelector(".excalidraw");
    const isDark = sourceEl?.classList.contains("theme--dark") ?? false;
    div.className = `excalidraw${isDark ? " theme--dark" : ""}`;
  }, [active]); // Re-sync whenever the dialog opens/closes

  useEffect(() => {
    const div = divRef.current!;
    document.body.appendChild(div);
    return () => {
      if (document.body.contains(div)) {
        document.body.removeChild(div);
      }
    };
  }, []);

  return divRef.current;
}

export const NewDiagramDialog: React.FC<NewDiagramDialogProps> = ({
  open,
  onClose,
  saveAsContent,
  saveAsCurrentName,
}) => {
  const [name, setName] = useState(
    saveAsCurrentName?.replace(/\.excalidraw$/, "") ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { createDraw } = useDraws();

  const isSaveAs = saveAsContent !== undefined;
  const sanitized = name.trim() ? sanitizeFilename(name.trim()) : "";

  const portalTarget = useThemedPortalContainer(open);

  useEffect(() => {
    if (open) {
      setName(saveAsCurrentName?.replace(/\.excalidraw$/, "") ?? "");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, saveAsCurrentName]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a diagram name");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await createDraw(trimmed, isSaveAs ? saveAsContent! : EMPTY_EXCALIDRAW);
      onClose();
    } catch (err: any) {
      if (err.code === "CONFLICT") {
        setError(
          `A diagram named "${sanitized}" already exists. Choose a different name.`,
        );
      } else {
        setError(err.message || "Failed to create diagram");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="Island"
        style={{
          borderRadius: "var(--border-radius-lg, 12px)",
          padding: "24px",
          width: "360px",
          boxShadow: "var(--modal-shadow, 0 20px 60px rgba(0,0,0,0.3))",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          border: "1px solid var(--dialog-border-color, transparent)",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--text-primary-color)",
            borderBottom: "1px solid var(--dialog-border-color)",
            paddingBottom: "0.75rem",
          }}
        >
          {isSaveAs ? "Save As" : "New Diagram"}
        </h3>

        <div className="ExcTextField ExcTextField--fullWidth">
          <div className="ExcTextField__label">Diagram name</div>
          <div className="ExcTextField__input">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
                if (e.key === "Escape") onClose();
              }}
              placeholder="e.g. architecture"
            />
          </div>
        </div>

        {sanitized && (
          <div
            style={{
              fontSize: "12px",
              color: "var(--color-gray-60)",
              marginTop: "-8px",
            }}
          >
            {`→ draws/${sanitized}`}
          </div>
        )}

        {error && (
          <div style={{ fontSize: "13px", color: "var(--color-danger)" }}>
            {error}
          </div>
        )}

        <div
          style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}
        >
          <button
            className="Dialog__action-button"
            onClick={onClose}
            disabled={loading}
            type="button"
          >
            Cancel
          </button>
          <button
            className="Dialog__action-button Dialog__action-button--primary"
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            type="button"
            style={{ opacity: loading || !name.trim() ? 0.6 : 1 }}
          >
            {loading ? "Creating..." : isSaveAs ? "Save Copy" : "Create"}
          </button>
        </div>
      </div>
    </div>,
    portalTarget,
  );
};
