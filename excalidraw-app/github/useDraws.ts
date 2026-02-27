import { useCallback, useRef } from "react";

import { appJotaiStore, useSetAtom } from "../app-jotai";

import {
  diagramTreeAtom,
  treeLoadingAtom,
  activeDiagramAtom,
  saveStateAtom,
} from "./atoms";

import type {
  DiagramTreeItem,
  FileResponse,
  CreateRequest,
  UpdateRequest,
  DeleteRequest,
  ApiError,
} from "./types";

// Strip the "draws/" prefix from a stored path to get the URL segment.
// Stored paths are relative to the repo root: "draws/foo/bar.excalidraw".
// The Express wildcard route is mounted at /api/draws/* and captures
// everything after that prefix, so we must not double it.
const toApiPath = (path: string): string => path.replace(/^draws\//, "");

// ---------------------------------------------------------------------------
// URL ?file= parameter helpers
// ---------------------------------------------------------------------------

/** Read the current ?file= query parameter. */
export const getFileParam = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get("file");
};

/** Update the URL to include ?file=<path> without a full page reload. */
const setFileParam = (path: string): void => {
  const url = new URL(window.location.href);
  url.searchParams.set("file", path);
  window.history.replaceState({}, "", url.toString());
};

/** Remove the ?file= parameter from the URL. */
const clearFileParam = (): void => {
  const url = new URL(window.location.href);
  url.searchParams.delete("file");
  window.history.replaceState({}, "", url.toString());
};

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err: ApiError = await res
      .json()
      .catch(() => ({ error: "Unknown error", code: "UNKNOWN" as const }));
    throw Object.assign(new Error(err.error), {
      code: err.code,
      status: res.status,
      retryAfter: err.retryAfter,
    });
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export const useDraws = () => {
  const setTree = useSetAtom(diagramTreeAtom);
  const setTreeLoading = useSetAtom(treeLoadingAtom);
  // Use useSetAtom (write-only) instead of useAtom to avoid subscribing
  // the calling component to activeDiagramAtom. Read imperatively where needed.
  const setActiveDiagram = useSetAtom(activeDiagramAtom);
  const setSaveState = useSetAtom(saveStateAtom);

  // Guard against concurrent saves — only one save at a time.
  // If a save is requested while one is in-flight, we queue the latest
  // content and save it once the current save completes.
  const saveInFlight = useRef(false);
  const pendingSave = useRef<{ content: string; forceSha?: string } | null>(
    null,
  );

  // Fetch and store the full diagram tree from the server.
  const listDraws = useCallback(async () => {
    setTreeLoading(true);
    try {
      const tree = await apiFetch<DiagramTreeItem[]>("/api/draws");
      setTree(tree);
    } catch (err) {
      console.error("[useDraws] listDraws failed:", err);
    } finally {
      setTreeLoading(false);
    }
  }, [setTree, setTreeLoading]);

  // Load a single diagram by its stored path (e.g. "draws/foo/bar.excalidraw").
  // Returns { file, content } so the caller (App.tsx) can push content onto the canvas.
  const openDraw = useCallback(
    async (path: string) => {
      try {
        const { file, content } = await apiFetch<FileResponse>(
          `/api/draws/${toApiPath(path)}`,
        );
        setActiveDiagram({ file, isDirty: false });
        setSaveState({ status: "saved" });
        setFileParam(file.path);
        document.title = `${file.name.replace(/\.excalidraw$/, "")} — InSpark Draw`;
        return { file, content };
      } catch (err: any) {
        console.error("[useDraws] openDraw failed:", err);
        throw err;
      }
    },
    [setActiveDiagram, setSaveState],
  );

  // Persist the current canvas content back to GitHub.
  // Serialized: only one save in-flight at a time. If called while saving,
  // the latest content is queued and saved after the current save completes.
  const doSave = useCallback(
    async (content: string, forceSha?: string) => {
      const activeDiagram = appJotaiStore.get(activeDiagramAtom);
      if (!activeDiagram) return;
      const { file } = activeDiagram;
      setSaveState({ status: "saving" });
      try {
        const body: UpdateRequest = {
          content,
          sha: forceSha ?? file.sha,
        };
        const response = await apiFetch<FileResponse>(
          `/api/draws/${toApiPath(file.path)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        // Store the new SHA returned by GitHub so the next save uses it.
        setActiveDiagram({ file: response.file, isDirty: false });
        setSaveState({ status: "saved" });
      } catch (err: any) {
        if (err.status === 409 || err.code === "CONFLICT") {
          setSaveState({ status: "conflict" });
        } else {
          setSaveState({
            status: "error",
            message: err.message || "Save failed",
          });
        }
        throw err;
      }
    },
    [setActiveDiagram, setSaveState],
  );

  const saveDraw = useCallback(
    async (content: string, forceSha?: string) => {
      if (saveInFlight.current) {
        // Another save is running — queue this one (latest wins).
        pendingSave.current = { content, forceSha };
        return;
      }
      saveInFlight.current = true;
      try {
        await doSave(content, forceSha);
      } finally {
        saveInFlight.current = false;
        // If a save was queued while we were saving, run it now
        // (it will read the updated SHA from the atom).
        const queued = pendingSave.current;
        if (queued) {
          pendingSave.current = null;
          saveDraw(queued.content, queued.forceSha).catch(console.error);
        }
      }
    },
    [doSave],
  );

  // Create a new diagram file in the repository.
  // rawPath is the user-supplied name/path relative to draws/ (server appends .excalidraw).
  const createDraw = useCallback(
    async (rawPath: string, content: string) => {
      const body: CreateRequest = { path: rawPath, content };
      try {
        const response = await apiFetch<FileResponse>("/api/draws", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        setActiveDiagram({ file: response.file, isDirty: false });
        setSaveState({ status: "saved" });
        setFileParam(response.file.path);
        document.title = `${response.file.name.replace(/\.excalidraw$/, "")} — InSpark Draw`;
        // Refresh the sidebar tree so the new file appears immediately.
        const tree = await apiFetch<DiagramTreeItem[]>("/api/draws");
        setTree(tree);
        return response;
      } catch (err: any) {
        setSaveState({
          status: "error",
          message: err.message || "Create failed",
        });
        throw err;
      }
    },
    [setActiveDiagram, setSaveState, setTree],
  );

  // Delete a diagram by its stored path and current blob SHA.
  const deleteDraw = useCallback(
    async (path: string, sha: string) => {
      const body: DeleteRequest = { sha };
      await apiFetch<void>(`/api/draws/${toApiPath(path)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      // If the deleted file was open, clear the canvas state and URL param.
      const activeDiagram = appJotaiStore.get(activeDiagramAtom);
      if (activeDiagram?.file.path === path) {
        setActiveDiagram(null);
        setSaveState({ status: "idle" });
        clearFileParam();
        document.title = "InSpark Draw";
      }
      // Refresh the sidebar tree to remove the deleted entry.
      const tree = await apiFetch<DiagramTreeItem[]>("/api/draws");
      setTree(tree);
    },
    [setActiveDiagram, setSaveState, setTree],
  );

  return {
    listDraws,
    openDraw,
    saveDraw,
    createDraw,
    deleteDraw,
  };
};
