import React, { useEffect, useState, useCallback } from "react";

import { useAtomValue } from "../../app-jotai";
import {
  diagramTreeAtom,
  treeLoadingAtom,
  activeDiagramAtom,
} from "../../github/atoms";
import { useDraws } from "../../github/useDraws";
import type { DiagramFile } from "../../github/types";
import { NewDiagramDialog } from "../NewDiagramDialog";

import { FileNode } from "./FileNode";

import "./FileBrowser.scss";

interface FileBrowserProps {
  onOpenFile: (content: string) => void;
}

const PlusIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const FileBrowser: React.FC<FileBrowserProps> = ({ onOpenFile }) => {
  const tree = useAtomValue(diagramTreeAtom);
  const loading = useAtomValue(treeLoadingAtom);
  const activeDiagram = useAtomValue(activeDiagramAtom);
  const { listDraws, openDraw, deleteDraw } = useDraws();
  const [error, setError] = useState<string | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  useEffect(() => {
    listDraws().catch((err: any) =>
      setError(err.message || "Failed to load diagrams"),
    );
  }, [listDraws]);

  const handleFileClick = useCallback(
    async (file: DiagramFile) => {
      setError(null);
      try {
        const result = await openDraw(file.path);
        if (result) {
          onOpenFile(result.content);
        }
      } catch (err: any) {
        setError(err.message || "Failed to open diagram");
      }
    },
    [openDraw, onOpenFile],
  );

  const handleDeleteClick = useCallback(
    async (file: DiagramFile) => {
      setError(null);
      try {
        await deleteDraw(file.path, file.sha);
      } catch (err: any) {
        setError(err.message || "Failed to delete diagram");
      }
    },
    [deleteDraw],
  );

  const header = (
    <div className="FileBrowser__header">
      <span className="FileBrowser__header-title">Diagrams</span>
      <button
        type="button"
        className="FileBrowser__new-btn"
        onClick={() => setNewDialogOpen(true)}
        title="New diagram"
        aria-label="New diagram"
      >
        <PlusIcon />
      </button>
    </div>
  );

  const dialog = (
    <NewDiagramDialog
      open={newDialogOpen}
      onClose={() => setNewDialogOpen(false)}
    />
  );

  if (loading) {
    return (
      <div className="FileBrowser">
        {header}
        <div className="FileBrowser__loading">Loading diagrams...</div>
        {dialog}
      </div>
    );
  }

  if (error) {
    return (
      <div className="FileBrowser">
        {header}
        <div className="FileBrowser__error">{error}</div>
        {dialog}
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="FileBrowser">
        {header}
        <div className="FileBrowser__empty">
          <div className="FileBrowser__empty-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
              <path d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
            </svg>
          </div>
          <div className="FileBrowser__empty-title">No diagrams yet</div>
          <div className="FileBrowser__empty-hint">
            Create a new diagram to get started
          </div>
          <button
            type="button"
            className="FileBrowser__empty-cta"
            onClick={() => setNewDialogOpen(true)}
          >
            <PlusIcon /> New diagram
          </button>
        </div>
        {dialog}
      </div>
    );
  }

  return (
    <div className="FileBrowser">
      {header}
      <div className="FileBrowser__tree">
        {tree.map((item) => (
          <FileNode
            key={item.path}
            item={item}
            depth={0}
            activeFilePath={activeDiagram?.file.path ?? null}
            onFileClick={handleFileClick}
            onDeleteClick={handleDeleteClick}
          />
        ))}
      </div>
      {dialog}
    </div>
  );
};
