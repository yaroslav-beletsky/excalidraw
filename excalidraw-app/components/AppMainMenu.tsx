import { MainMenu } from "@excalidraw/excalidraw/index";
import React, { useState, useMemo } from "react";

import type { Theme } from "@excalidraw/element/types";

import { appJotaiStore, useAtomValue } from "../app-jotai";
import { authUserAtom } from "../auth/authAtom";
import { activeDiagramAtom } from "../github/atoms";

import { LanguageList } from "../app-language/LanguageList";

import { NewDiagramDialog } from "./NewDiagramDialog";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  getSceneContent?: () => string;
}> = React.memo((props) => {
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsSnapshot, setSaveAsSnapshot] = useState<{
    name: string;
    content: string;
  } | null>(null);

  const authUser = useAtomValue(authUserAtom);
  // NOTE: activeDiagramAtom is read imperatively (appJotaiStore.get) instead
  // of via useAtomValue to avoid re-rendering AppMainMenu when it changes.
  // Re-rendering MainMenu triggers tunnel-rat's <In> infinite loop.

  const isAuthenticated = authUser?.authenticated === true;

  // Memoize MainMenu children so tunnel-rat's <In> receives stable references
  // and doesn't enter an infinite re-render loop when atoms like activeDiagramAtom change.
  const menuChildren = useMemo(
    () => (
      <>
        <MainMenu.DefaultItems.LoadScene />
        <MainMenu.DefaultItems.SaveToActiveFile />
        <MainMenu.DefaultItems.Export />
        <MainMenu.DefaultItems.SaveAsImage />
        {props.isCollabEnabled && (
          <MainMenu.DefaultItems.LiveCollaborationTrigger
            isCollaborating={props.isCollaborating}
            onSelect={() => props.onCollabDialogOpen()}
          />
        )}
        <MainMenu.DefaultItems.CommandPalette className="highlighted" />
        <MainMenu.DefaultItems.SearchMenu />
        <MainMenu.DefaultItems.Help />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.Separator />
        <MainMenu.DefaultItems.Preferences />
        <MainMenu.DefaultItems.ToggleTheme
          allowSystemTheme
          theme={props.theme}
          onSelect={props.setTheme}
        />
        <MainMenu.ItemCustom>
          <LanguageList style={{ width: "100%" }} />
        </MainMenu.ItemCustom>
        <MainMenu.DefaultItems.ChangeCanvasBackground />
        {isAuthenticated && (
          <>
            <MainMenu.Separator />
            <MainMenu.Item onSelect={() => setNewDialogOpen(true)}>
              New Diagram
            </MainMenu.Item>
            <MainMenu.Item
              onSelect={() => {
                const diagram = appJotaiStore.get(activeDiagramAtom);
                if (diagram) {
                  setSaveAsSnapshot({
                    name: diagram.file.name,
                    content:
                      props.getSceneContent?.() ??
                      JSON.stringify({
                        type: "excalidraw",
                        version: 2,
                        source: "inspark-draw",
                        elements: [],
                        appState: {
                          gridSize: null,
                          viewBackgroundColor: "#ffffff",
                        },
                        files: {},
                      }),
                  });
                }
                setSaveAsOpen(true);
              }}
            >
              Save As...
            </MainMenu.Item>
          </>
        )}
      </>
    ),
    // Only re-create children when these specific values change — NOT on every render
    [props.isCollabEnabled, props.isCollaborating, props.theme, isAuthenticated],
  );

  return (
    <>
      <MainMenu>{menuChildren}</MainMenu>

      <NewDiagramDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
      />

      <NewDiagramDialog
        open={saveAsOpen}
        onClose={() => {
          setSaveAsOpen(false);
          setSaveAsSnapshot(null);
        }}
        saveAsContent={saveAsSnapshot?.content}
        saveAsCurrentName={saveAsSnapshot?.name}
      />
    </>
  );
});
