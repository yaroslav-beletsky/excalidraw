# Data Model: GitHub Storage for Diagrams

**Feature**: `001-github-storage`
**Date**: 2026-02-26

---

## Core Entities

### DiagramFile

Represents a single `.excalidraw` file stored in the repository.

```ts
interface DiagramFile {
  type: "file";
  name: string;       // "architecture.excalidraw"
  path: string;       // "draws/architecture.excalidraw" (relative to repo root)
  sha: string;        // Git blob SHA — used for conflict detection (FR-010)
  lastModified: string;  // ISO 8601 timestamp from GitHub commit metadata
  lastModifiedBy: string; // GitHub username or Authentik username from commit
  size: number;       // bytes
}
```

**SHA lifecycle**:
- Obtained from `GET /api/draws/*` response (passed from GitHub Contents API)
- Stored in `activeDiagramAtom` after open
- Sent back with every `PUT /api/draws/*` request
- GitHub rejects PUT if SHA doesn't match current blob → 409 Conflict
- Updated in atom after successful save (new SHA from PUT response)

---

### DiagramFolder

Represents a subfolder under `draws/`.

```ts
interface DiagramFolder {
  type: "folder";
  name: string;       // "architecture"
  path: string;       // "draws/architecture"
  children: DiagramTreeItem[];  // may be empty
  expanded: boolean;  // UI state — not persisted
}

type DiagramTreeItem = DiagramFile | DiagramFolder;
```

---

### ActiveDiagram

The diagram currently loaded on the canvas.

```ts
interface ActiveDiagram {
  file: DiagramFile;           // metadata including SHA
  isDirty: boolean;            // true if canvas has unsaved changes
}

// null = no diagram open (blank canvas or locally-only canvas)
type ActiveDiagramState = ActiveDiagram | null;
```

---

### SaveState

The current persistence status of the active diagram.

```ts
type SaveState =
  | { status: "idle" }       // no active diagram linked to repo
  | { status: "saved" }      // in sync with repo
  | { status: "unsaved" }    // local changes not yet committed
  | { status: "saving" }     // PUT request in flight
  | { status: "error"; message: string }  // last save failed
  | { status: "conflict" };  // SHA mismatch detected
```

---

## Jotai Atoms (Client State)

```ts
// excalidraw-app/github/atoms.ts

// Full tree of draws/ folder — refreshed on mount and after mutations
export const diagramTreeAtom = atom<DiagramTreeItem[]>([]);

// Loading state for the tree fetch
export const treeLoadingAtom = atom<boolean>(false);

// Currently open diagram and its metadata
export const activeDiagramAtom = atom<ActiveDiagramState>(null);

// Save status for UI indicator
export const saveStateAtom = atom<SaveState>({ status: "idle" });
```

Atoms follow the existing project pattern from `excalidraw-app/app-jotai.ts`.

---

## Server-Side Config

Environment variables (server.js reads from `process.env`):

```env
GITHUB_PAT=ghp_...           # Personal Access Token (repo scope)
GITHUB_OWNER=inspark-me      # Repository owner
GITHUB_REPO=docs             # Repository name
GITHUB_BRANCH=main           # Branch to read/write
GITHUB_DRAWS_PATH=draws      # Folder within repo
```

These are never passed to the client (FR-012).

---

## API Request/Response Shapes

Used by both server implementation and client fetch calls:

### List Response

```ts
// GET /api/draws → DiagramTreeItem[]
// Server converts GitHub flat listing into nested tree
type ListResponse = DiagramTreeItem[];
```

### File Response

```ts
// GET /api/draws/* → FileResponse
interface FileResponse {
  file: DiagramFile;
  content: string;  // parsed excalidraw JSON string (decoded from base64)
}
```

### Create/Update Request

```ts
// POST /api/draws → CreateRequest
interface CreateRequest {
  path: string;      // relative path within draws/, e.g. "architecture.excalidraw"
  content: string;   // excalidraw JSON string
}

// PUT /api/draws/* → UpdateRequest
interface UpdateRequest {
  content: string;   // excalidraw JSON string
  sha: string;       // current blob SHA (for conflict detection)
  message?: string;  // optional override; server generates default
}
```

### Delete Request

```ts
// DELETE /api/draws/* → DeleteRequest
interface DeleteRequest {
  sha: string;   // current blob SHA
}
```

### Error Response

```ts
interface ApiError {
  error: string;
  code?: "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" | "AUTH_ERROR" | "UNKNOWN";
  retryAfter?: number;  // seconds, present when code = "RATE_LIMITED"
}
```

---

## Filename Sanitization Rule (FR-011)

Applied on the server before constructing GitHub paths:

```
allowed: [a-zA-Z0-9] + [-_./]
replace: anything else → "-"
strip: leading/trailing dots and slashes
append: ".excalidraw" if not already present
```

Example: `"My Diagram (v2)!"` → `"My-Diagram--v2-.excalidraw"`

---

## Commit Message Format (FR-004, FR-013)

```
Create: {filename} by {username}   ← POST (new file)
Update: {filename} by {username}   ← PUT (existing file)
Delete: {filename} by {username}   ← DELETE
```

Where:
- `{filename}` = basename only (not full path): `architecture.excalidraw`
- `{username}` = value from `X-User` Authentik header on the request
