import React, { useEffect, useState, useCallback, useMemo } from "react";

import { useAtomValue } from "../../app-jotai";
import {
  diagramTreeAtom,
  treeLoadingAtom,
  activeDiagramAtom,
} from "../../github/atoms";
import { useDraws } from "../../github/useDraws";
import type { DiagramFile, DiagramTreeItem } from "../../github/types";
import { NewDiagramDialog } from "../NewDiagramDialog";

import { FileNode } from "./FileNode";
import type { SortMode } from "./FileNode";

import "./FileBrowser.scss";

interface FileBrowserProps {
  onOpenFile: (content: string) => void;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

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

const SortAlphaIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 6h7" />
    <path d="M4 12h5" />
    <path d="M4 18h3" />
    <path d="M15 6v12l5-6" />
  </svg>
);

const SortDateIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 15" />
  </svg>
);

const SearchIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const ClearIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ---------------------------------------------------------------------------
// Tree filtering + sorting helpers
// ---------------------------------------------------------------------------

function filterTree(
  items: DiagramTreeItem[],
  query: string,
): DiagramTreeItem[] {
  if (!query) {
    return items;
  }
  const lower = query.toLowerCase();
  const result: DiagramTreeItem[] = [];
  for (const item of items) {
    if (item.type === "file") {
      if (item.name.toLowerCase().includes(lower)) {
        result.push(item);
      }
    } else {
      const filteredChildren = filterTree(item.children, query);
      if (filteredChildren.length > 0) {
        result.push({ ...item, children: filteredChildren });
      }
    }
  }
  return result;
}

function sortTree(
  items: DiagramTreeItem[],
  mode: SortMode,
): DiagramTreeItem[] {
  const sorted = [...items].sort((a, b) => {
    if (a.type === "folder" && b.type === "file") {
      return -1;
    }
    if (a.type === "file" && b.type === "folder") {
      return 1;
    }
    if (mode === "date" && a.type === "file" && b.type === "file") {
      const aFile = a as DiagramFile;
      const bFile = b as DiagramFile;
      return (
        new Date(bFile.lastModified).getTime() -
        new Date(aFile.lastModified).getTime()
      );
    }
    return a.name.localeCompare(b.name);
  });

  return sorted.map((item) => {
    if (item.type === "folder") {
      return { ...item, children: sortTree(item.children, mode) };
    }
    return item;
  });
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

const SKELETON_WIDTHS = [75, 60, 88, 55, 70];

const SkeletonRows = () => (
  <div className="FileBrowser__skeleton">
    {SKELETON_WIDTHS.map((w, i) => (
      <div key={i} className="FileBrowser__skeleton-row">
        <div className="FileBrowser__skeleton-icon" />
        <div
          className="FileBrowser__skeleton-text"
          style={{ width: `${w}%` }}
        />
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Empty state illustration
// ---------------------------------------------------------------------------

const EmptyIllustration = () => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect
      x="8"
      y="12"
      width="48"
      height="40"
      rx="4"
      stroke="currentColor"
      strokeWidth="2"
    />
    <rect
      x="8"
      y="12"
      width="48"
      height="10"
      rx="4"
      fill="currentColor"
      opacity="0.15"
    />
    <line
      x1="14"
      y1="17"
      x2="20"
      y2="17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="40" cy="38" r="10" stroke="currentColor" strokeWidth="2" />
    <line
      x1="40"
      y1="33"
      x2="40"
      y2="43"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="35"
      y1="38"
      x2="45"
      y2="38"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FileBrowser: React.FC<FileBrowserProps> = ({ onOpenFile }) => {
  const tree = useAtomValue(diagramTreeAtom);
  const loading = useAtomValue(treeLoadingAtom);
  const activeDiagram = useAtomValue(activeDiagramAtom);
  const { listDraws, openDraw, deleteDraw } = useDraws();
  const [error, setError] = useState<string | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("name");

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

  const displayTree = useMemo(
    () => sortTree(filterTree(tree, searchQuery), sortMode),
    [tree, searchQuery, sortMode],
  );

  const toggleSort = () =>
    setSortMode((prev) => (prev === "name" ? "date" : "name"));

  const hasItems = tree.length > 0;

  const header = (
    <div className="FileBrowser__header">
      <span className="FileBrowser__header-title">Diagrams</span>
      <div className="FileBrowser__header-actions">
        {hasItems && !loading && (
          <button
            type="button"
            className={`FileBrowser__sort-btn${sortMode === "date" ? " FileBrowser__sort-btn--active" : ""}`}
            onClick={toggleSort}
            title={sortMode === "name" ? "Sort by date" : "Sort by name"}
            aria-label={sortMode === "name" ? "Sort by date" : "Sort by name"}
          >
            {sortMode === "name" ? <SortAlphaIcon /> : <SortDateIcon />}
          </button>
        )}
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
    </div>
  );

  const searchBar = hasItems && !loading && (
    <div className="FileBrowser__search">
      <SearchIcon />
      <input
        type="text"
        className="FileBrowser__search-input"
        placeholder="Search diagrams..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      {searchQuery && (
        <button
          type="button"
          className="FileBrowser__search-clear"
          onClick={() => setSearchQuery("")}
          aria-label="Clear search"
        >
          <ClearIcon />
        </button>
      )}
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
        <SkeletonRows />
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
            <EmptyIllustration />
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
      {searchBar}
      {displayTree.length === 0 && searchQuery ? (
        <div className="FileBrowser__search-empty">
          No diagrams matching &ldquo;{searchQuery}&rdquo;
        </div>
      ) : (
        <div className="FileBrowser__tree">
          {displayTree.map((item) => (
            <FileNode
              key={item.path}
              item={item}
              depth={0}
              activeFilePath={activeDiagram?.file.path ?? null}
              onFileClick={handleFileClick}
              onDeleteClick={handleDeleteClick}
              sortMode={sortMode}
            />
          ))}
        </div>
      )}
      {dialog}
    </div>
  );
};
