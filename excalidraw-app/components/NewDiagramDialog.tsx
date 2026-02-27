import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

import { sanitizeFilename } from "../github/sanitize";
import { useDraws } from "../github/useDraws";
import { TEMPLATES } from "./diagramTemplates";
import type { DiagramTemplate } from "./diagramTemplates";

import "./NewDiagramDialog.scss";

interface NewDiagramDialogProps {
  open: boolean;
  onClose: () => void;
  saveAsContent?: string;
  saveAsCurrentName?: string;
}

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
  const [selectedTemplate, setSelectedTemplate] = useState<DiagramTemplate>(
    TEMPLATES[0],
  );
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { createDraw } = useDraws();

  const isSaveAs = saveAsContent !== undefined;
  const sanitized = name.trim() ? sanitizeFilename(name.trim()) : "";

  const portalTarget = useThemedPortalContainer(open);

  useEffect(() => {
    if (open) {
      setName(saveAsCurrentName?.replace(/\.excalidraw$/, "") ?? "");
      setError(null);
      setSelectedTemplate(TEMPLATES[0]);
      setNameManuallyEdited(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, saveAsCurrentName]);

  const handleTemplateSelect = (template: DiagramTemplate) => {
    setSelectedTemplate(template);
    if (!nameManuallyEdited) {
      setName(template.defaultName);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setNameManuallyEdited(true);
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a diagram name");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await createDraw(
        trimmed,
        isSaveAs ? saveAsContent! : selectedTemplate.content,
      );
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
    <div className="NewDiagramDialog__backdrop" onClick={handleBackdropClick}>
      <div
        className={`NewDiagramDialog${isSaveAs ? " NewDiagramDialog--saveAs" : ""}`}
      >
        <h3 className="NewDiagramDialog__title">
          {isSaveAs ? "Save As" : "New Diagram"}
        </h3>

        {!isSaveAs && (
          <div className="NewDiagramDialog__templates">
            {TEMPLATES.map((tmpl) => {
              const Icon = tmpl.icon;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  className={`NewDiagramDialog__template-card${
                    selectedTemplate.id === tmpl.id
                      ? " NewDiagramDialog__template-card--selected"
                      : ""
                  }`}
                  onClick={() => handleTemplateSelect(tmpl)}
                  aria-pressed={selectedTemplate.id === tmpl.id}
                >
                  <span className="NewDiagramDialog__template-icon">
                    <Icon />
                  </span>
                  <span className="NewDiagramDialog__template-label">
                    {tmpl.label}
                  </span>
                  <span className="NewDiagramDialog__template-desc">
                    {tmpl.description}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="ExcTextField ExcTextField--fullWidth">
          <div className="ExcTextField__label">Diagram name</div>
          <div className="ExcTextField__input">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={handleNameChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit();
                }
                if (e.key === "Escape") {
                  onClose();
                }
              }}
              placeholder="e.g. architecture"
            />
          </div>
        </div>

        {sanitized && (
          <div className="NewDiagramDialog__path-preview">
            {`\u2192 draws/${sanitized}`}
          </div>
        )}

        {error && <div className="NewDiagramDialog__error">{error}</div>}

        <div className="NewDiagramDialog__actions">
          <button
            className="NewDiagramDialog__btn NewDiagramDialog__btn--secondary"
            onClick={onClose}
            disabled={loading}
            type="button"
          >
            Cancel
          </button>
          <button
            className="NewDiagramDialog__btn NewDiagramDialog__btn--primary"
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            type="button"
          >
            {loading ? "Creating..." : isSaveAs ? "Save Copy" : "Create"}
          </button>
        </div>
      </div>
    </div>,
    portalTarget,
  );
};
