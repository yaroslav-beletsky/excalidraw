import React from "react";

import { DefaultSidebar, Sidebar } from "@excalidraw/excalidraw";

import { FileBrowser } from "./FileBrowser/FileBrowser";

const FILES_TAB = "__files";

const FilesTabIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    aria-label="Files"
  >
    <path d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
  </svg>
);

interface AppSidebarProps {
  onOpenFile: (content: string) => void;
}

export const AppSidebar = React.memo(({ onOpenFile }: AppSidebarProps) => {
  return (
    <DefaultSidebar>
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger tab={FILES_TAB} title="Files">
          <FilesTabIcon />
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>
      <Sidebar.Tab tab={FILES_TAB}>
        <FileBrowser onOpenFile={onOpenFile} />
      </Sidebar.Tab>
    </DefaultSidebar>
  );
});
