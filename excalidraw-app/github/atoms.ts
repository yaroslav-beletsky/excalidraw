import { atom } from "../app-jotai";

import type { DiagramTreeItem, ActiveDiagram, SaveState } from "./types";

// Full tree of draws/ folder — refreshed on mount and after mutations
export const diagramTreeAtom = atom<DiagramTreeItem[]>([]);

// Loading state for the tree fetch
export const treeLoadingAtom = atom<boolean>(false);

// Currently open diagram and its metadata (null = no diagram linked to repo)
export const activeDiagramAtom = atom<ActiveDiagram | null>(null);

// Save status for the UI indicator
export const saveStateAtom = atom<SaveState>({ status: "idle" });
