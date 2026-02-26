// 1. Core file entities
export interface DiagramFile {
  type: "file";
  name: string;          // "architecture.excalidraw"
  path: string;          // "draws/architecture.excalidraw" (relative to repo root)
  sha: string;           // Git blob SHA — for conflict detection
  lastModified: string;  // ISO 8601
  lastModifiedBy: string;
  size: number;          // bytes
}

export interface DiagramFolder {
  type: "folder";
  name: string;
  path: string;
  children: DiagramTreeItem[];
}

export type DiagramTreeItem = DiagramFile | DiagramFolder;

// 2. Active diagram state (what's open on the canvas)
export interface ActiveDiagram {
  file: DiagramFile;
  isDirty: boolean;  // true = unsaved changes on canvas
}

// 3. Save state
export type SaveState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "unsaved" }
  | { status: "saving" }
  | { status: "error"; message: string }
  | { status: "conflict" };

// 4. API shapes — used by useDraws.ts fetch calls and server.js responses

export interface FileResponse {
  file: DiagramFile;
  content: string;  // raw excalidraw JSON string
}

export interface CreateRequest {
  path: string;    // relative path within draws/, .excalidraw appended by server
  content: string; // excalidraw JSON string
}

export interface UpdateRequest {
  content: string;
  sha: string;     // current blob SHA
  message?: string;
}

export interface DeleteRequest {
  sha: string;
}

export type ApiErrorCode = "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" | "AUTH_ERROR" | "UNKNOWN";

export interface ApiError {
  error: string;
  code?: ApiErrorCode;
  retryAfter?: number;  // seconds, present when code = RATE_LIMITED
}
