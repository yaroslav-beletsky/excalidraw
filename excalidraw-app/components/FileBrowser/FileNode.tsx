import * as ContextMenu from "@radix-ui/react-context-menu";
import React, { useState } from "react";

import type {
  DiagramFile,
  DiagramFolder,
  DiagramTreeItem,
} from "../../github/types";

export type SortMode = "name" | "date";

interface FileNodeProps {
  item: DiagramTreeItem;
  depth: number;
  activeFilePath: string | null;
  onFileClick: (file: DiagramFile) => void;
  onDeleteClick?: (file: DiagramFile) => void;
  sortMode?: SortMode;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const ChevronIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
  </svg>
);

const FileIcon = () => (
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
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const TrashIcon = () => (
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
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const formatRelativeTime = (isoDate: string): string => {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const sortChildren = (children: DiagramTreeItem[], mode: SortMode = "name"): DiagramTreeItem[] => {
  return [...children].sort((a, b) => {
    // Folders always first
    if (a.type === "folder" && b.type === "file") {
      return -1;
    }
    if (a.type === "file" && b.type === "folder") {
      return 1;
    }
    if (mode === "date" && a.type === "file" && b.type === "file") {
      const aFile = a as DiagramFile;
      const bFile = b as DiagramFile;
      return new Date(bFile.lastModified).getTime() - new Date(aFile.lastModified).getTime();
    }
    return a.name.localeCompare(b.name);
  });
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FileNode: React.FC<FileNodeProps> = ({
  item,
  depth,
  activeFilePath,
  onFileClick,
  onDeleteClick,
  sortMode = "name",
}) => {
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (item.type === "folder") {
    const folder = item as DiagramFolder;
    const sorted = sortChildren(folder.children, sortMode);

    return (
      <div className="FileNode FileNode--folder">
        <button
          type="button"
          className="FileNode__row"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} folder ${folder.name}`}
        >
          <span
            className="FileNode__indent"
            style={{ width: depth * 20 }}
            aria-hidden="true"
          />
          <span
            className={`FileNode__chevron${isExpanded ? " is-open" : ""}`}
            aria-hidden="true"
          >
            <ChevronIcon />
          </span>
          <span className="FileNode__icon FileNode__icon--folder" aria-hidden="true">
            <FolderIcon />
          </span>
          <span className="FileNode__name">{folder.name}</span>
        </button>

        {/* Always in DOM — CSS grid animates open/close */}
        <div className={`FileNode__children-wrapper${isExpanded ? " is-open" : ""}`}>
          <div className="FileNode__children">
            {sorted.map((child) => (
              <FileNode
                key={child.path}
                item={child}
                depth={depth + 1}
                activeFilePath={activeFilePath}
                onFileClick={onFileClick}
                onDeleteClick={onDeleteClick}
                sortMode={sortMode}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const file = item as DiagramFile;
  const isActive = activeFilePath === file.path;
  const displayName = file.name.replace(/\.excalidraw$/, "");

  const handleDeleteConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteClick?.(file);
    setConfirmDelete(false);
  };

  const handleDeleteCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(false);
  };

  const fileRow = (
    <div
      className={`FileNode FileNode--file${isActive ? " FileNode--active" : ""}`}
    >
      <button
        type="button"
        className="FileNode__row"
        onClick={() => onFileClick(file)}
        aria-current={isActive ? "page" : undefined}
        aria-label={`Open ${displayName}`}
      >
        <span
          className="FileNode__indent"
          style={{ width: depth * 20 }}
          aria-hidden="true"
        />
        <span className="FileNode__icon FileNode__icon--file" aria-hidden="true">
          <FileIcon />
        </span>
        <span className="FileNode__name">{displayName}</span>
        {!confirmDelete && (
          <span className="FileNode__meta">
            {formatRelativeTime(file.lastModified)}
          </span>
        )}
      </button>

      {confirmDelete ? (
        <span className="FileNode__delete-confirm">
          <button
            type="button"
            className="FileNode__delete-confirm-yes"
            onClick={handleDeleteConfirm}
            aria-label={`Confirm delete ${displayName}`}
          >
            Delete
          </button>
          <button
            type="button"
            className="FileNode__delete-confirm-no"
            onClick={handleDeleteCancel}
            aria-label="Cancel delete"
          >
            Cancel
          </button>
        </span>
      ) : (
        onDeleteClick && (
          <button
            type="button"
            className="FileNode__delete"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            aria-label={`Delete ${displayName}`}
            title="Delete diagram"
          >
            <TrashIcon />
          </button>
        )
      )}
    </div>
  );

  if (!onDeleteClick) {
    return fileRow;
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{fileRow}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="FileNode__context-menu">
          <ContextMenu.Item
            className="FileNode__context-menu-item FileNode__context-menu-item--danger"
            onSelect={() => setConfirmDelete(true)}
          >
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};
