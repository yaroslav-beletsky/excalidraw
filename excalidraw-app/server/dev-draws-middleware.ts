import type { Plugin } from "vite";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiagramFile {
  type: "file";
  name: string;
  path: string;
  sha: string;
  lastModified: string;
  lastModifiedBy: string;
  size: number;
}

interface DiagramFolder {
  type: "folder";
  name: string;
  path: string;
  children: DiagramTreeItem[];
}

type DiagramTreeItem = DiagramFile | DiagramFolder;

interface FileResponse {
  file: DiagramFile;
  content: string;
}

export interface DrawsMiddlewareConfig {
  /** GitHub Personal Access Token — if set, real GitHub API is used */
  pat?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  drawsPath?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getBody = (req: any): Promise<any> =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });

function jsonResponse(res: any, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function errorResponse(res: any, statusCode: number, message: string, code = "ERROR"): void {
  jsonResponse(res, statusCode, { error: message, code });
}

// ---------------------------------------------------------------------------
// Real GitHub mode — native fetch, no extra deps needed (Node 18+)
// ---------------------------------------------------------------------------

function ghHeaders(pat: string): Record<string, string> {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function ghGet(url: string, pat: string) {
  const res = await fetch(url, { headers: ghHeaders(pat) });
  return res;
}

async function buildGitHubTree(
  cfg: Required<DrawsMiddlewareConfig>,
  dirPath: string,
): Promise<DiagramTreeItem[]> {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${dirPath}?ref=${cfg.branch}`;
  const res = await ghGet(url, cfg.pat);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as any[];
  if (!Array.isArray(data)) return [];

  const items: DiagramTreeItem[] = [];

  for (const item of data) {
    if (item.type === "dir") {
      const children = await buildGitHubTree(cfg, item.path);
      items.push({ type: "folder", name: item.name, path: item.path, children });
    } else if (item.type === "file" && item.name.endsWith(".excalidraw")) {
      let lastModified = new Date().toISOString();
      let lastModifiedBy = "unknown";
      try {
        const commitUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/commits?sha=${cfg.branch}&path=${encodeURIComponent(item.path)}&per_page=1`;
        const commitRes = await ghGet(commitUrl, cfg.pat);
        if (commitRes.ok) {
          const commits = (await commitRes.json()) as any[];
          if (commits.length > 0) {
            lastModified = commits[0].commit.committer.date;
            lastModifiedBy =
              commits[0].commit.author?.name ||
              commits[0].author?.login ||
              "unknown";
          }
        }
      } catch (_) {
        // non-fatal — fall back to defaults
      }

      items.push({
        type: "file",
        name: item.name,
        path: item.path,
        sha: item.sha,
        lastModified,
        lastModifiedBy,
        size: item.size,
      });
    }
  }

  return items;
}

async function getGitHubFile(
  cfg: Required<DrawsMiddlewareConfig>,
  filePath: string,
): Promise<FileResponse | null> {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${filePath}?ref=${cfg.branch}`;
  const res = await ghGet(url, cfg.pat);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);

  const data = (await res.json()) as any;
  if (Array.isArray(data)) return null; // it's a directory

  const content = Buffer.from(data.content as string, "base64").toString("utf-8");
  const file: DiagramFile = {
    type: "file",
    name: data.name,
    path: data.path,
    sha: data.sha,
    lastModified: new Date().toISOString(),
    lastModifiedBy: "unknown",
    size: data.size,
  };
  return { file, content };
}

async function putGitHubFile(
  cfg: Required<DrawsMiddlewareConfig>,
  filePath: string,
  content: string,
  message: string,
  sha?: string,
): Promise<DiagramFile> {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${filePath}`;
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content).toString("base64"),
    branch: cfg.branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: ghHeaders(cfg.pat),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`GitHub PUT error ${res.status}: ${text}`) as any;
    err.status = res.status;
    throw err;
  }

  const data = (await res.json()) as any;
  return {
    type: "file",
    name: data.content.name,
    path: data.content.path,
    sha: data.content.sha,
    lastModified: new Date().toISOString(),
    lastModifiedBy: "unknown",
    size: Buffer.byteLength(content),
  };
}

async function deleteGitHubFile(
  cfg: Required<DrawsMiddlewareConfig>,
  filePath: string,
  sha: string,
  message: string,
): Promise<void> {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${filePath}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: ghHeaders(cfg.pat),
    body: JSON.stringify({ message, sha, branch: cfg.branch }),
  });
  if (!res.ok) {
    const err = new Error(`GitHub DELETE error ${res.status}`) as any;
    err.status = res.status;
    throw err;
  }
}

function sanitizeFilename(input: string): string {
  let name = input
    .replace(/[^a-zA-Z0-9\-_./]/g, "-")
    .replace(/^[./]+/, "")
    .replace(/[./]+$/, "")
    .replace(/-{2,}/g, "-");
  if (!name) name = "untitled";
  if (!name.endsWith(".excalidraw")) name = `${name}.excalidraw`;
  return name;
}

// ---------------------------------------------------------------------------
// In-memory mock (fallback when no PAT is configured)
// ---------------------------------------------------------------------------

const MOCK_CONTENT =
  '{"type":"excalidraw","version":2,"source":"inspark-draw","elements":[],"appState":{"gridSize":null,"viewBackgroundColor":"#ffffff"},"files":{}}';

function buildTree(
  store: Map<string, { file: DiagramFile; content: string }>,
): DiagramTreeItem[] {
  const root: DiagramTreeItem[] = [];

  for (const [, { file }] of store.entries()) {
    const segments = file.path.split("/");
    let current = root;

    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      const folderPath = segments.slice(0, i + 1).join("/");
      let folder = current.find(
        (item): item is DiagramFolder =>
          item.type === "folder" && item.name === segment,
      );
      if (!folder) {
        folder = { type: "folder", name: segment, path: folderPath, children: [] };
        current.push(folder);
      }
      current = folder.children;
    }
    current.push({ ...file });
  }

  return root;
}

function createMockStore(): Map<string, { file: DiagramFile; content: string }> {
  const now = new Date().toISOString();
  const entries = [
    { path: "draws/overview.excalidraw", sha: "sha-overview-001" },
    { path: "draws/architecture/backend.excalidraw", sha: "sha-backend-001" },
    { path: "draws/architecture/frontend.excalidraw", sha: "sha-frontend-001" },
  ];
  const store = new Map<string, { file: DiagramFile; content: string }>();
  for (const { path, sha } of entries) {
    const name = path.split("/").pop()!;
    store.set(path, {
      file: { type: "file", name, path, sha, lastModified: now, lastModifiedBy: "dev-user", size: MOCK_CONTENT.length },
      content: MOCK_CONTENT,
    });
  }
  return store;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * Vite dev plugin that handles /api/draws* endpoints.
 *
 * Modes:
 *  - Real GitHub: when `config.pat` is provided → calls GitHub Contents API
 *  - Mock:        when no PAT → in-memory fake store (default for local dev)
 */
export const devDrawsMiddleware = (config: DrawsMiddlewareConfig = {}): Plugin => {
  const pat = config.pat || "";
  const owner = config.owner || "inspark-me";
  const repo = config.repo || "docs";
  const branch = config.branch || "main";
  const drawsPath = config.drawsPath || "draws";
  const useReal = Boolean(pat);

  const ghCfg: Required<DrawsMiddlewareConfig> = { pat, owner, repo, branch, drawsPath };

  // Mock store — only used when no PAT is configured
  const mockStore = useReal ? new Map() : createMockStore();

  const mode = useReal
    ? `🐙 GitHub mode (${owner}/${repo}@${branch}, path="${drawsPath}")`
    : "🧪 Mock mode (in-memory)";

  return {
    name: "dev-draws-middleware",
    configureServer(server) {
      console.log(`[dev-draws] ${mode}`);

      server.middlewares.use(async (req: any, res: any, next: () => void) => {
        if (!req.url?.startsWith("/api/draws")) {
          next();
          return;
        }

        const parsed = new URL(req.url!, "http://localhost");
        const pathname = parsed.pathname;
        const method = (req.method ?? "GET").toUpperCase();

        try {
          // ---------------------------------------------------------------
          // GET /api/draws — full tree
          // ---------------------------------------------------------------
          if (method === "GET" && pathname === "/api/draws") {
            if (useReal) {
              const tree = await buildGitHubTree(ghCfg, drawsPath);
              jsonResponse(res, 200, tree);
            } else {
              jsonResponse(res, 200, buildTree(mockStore));
            }
            return;
          }

          // ---------------------------------------------------------------
          // GET /api/draws/* — single file
          // ---------------------------------------------------------------
          if (method === "GET" && pathname.startsWith("/api/draws/")) {
            const relPath = pathname.slice("/api/draws/".length); // e.g. "overview.excalidraw"
            if (useReal) {
              const fullPath = `${drawsPath}/${relPath}`;
              const result = await getGitHubFile(ghCfg, fullPath);
              if (!result) { errorResponse(res, 404, "File not found", "NOT_FOUND"); return; }
              jsonResponse(res, 200, result);
            } else {
              const storePath = `draws/${relPath}`;
              const entry = mockStore.get(storePath);
              if (!entry) { errorResponse(res, 404, "File not found", "NOT_FOUND"); return; }
              jsonResponse(res, 200, entry);
            }
            return;
          }

          // ---------------------------------------------------------------
          // POST /api/draws — create file
          // ---------------------------------------------------------------
          if (method === "POST" && pathname === "/api/draws") {
            let body: { path: string; content: string };
            try { body = await getBody(req); } catch { errorResponse(res, 400, "Invalid JSON"); return; }
            if (!body.path || typeof body.content !== "string") {
              errorResponse(res, 400, "Missing required fields: path, content"); return;
            }

            if (useReal) {
              const safeName = sanitizeFilename(body.path);
              const fullPath = `${drawsPath}/${safeName}`;
              const file = await putGitHubFile(ghCfg, fullPath, body.content, `Create: ${safeName}`);
              jsonResponse(res, 201, { file, content: body.content });
            } else {
              if (mockStore.has(body.path)) { errorResponse(res, 409, "File already exists", "CONFLICT"); return; }
              const name = body.path.split("/").pop()!;
              const sha = `sha-${Date.now()}`;
              const file: DiagramFile = { type: "file", name, path: body.path, sha, lastModified: new Date().toISOString(), lastModifiedBy: "dev-user", size: body.content.length };
              mockStore.set(body.path, { file, content: body.content });
              jsonResponse(res, 201, { file, content: body.content });
            }
            return;
          }

          // ---------------------------------------------------------------
          // PUT /api/draws/* — update file
          // ---------------------------------------------------------------
          if (method === "PUT" && pathname.startsWith("/api/draws/")) {
            const relPath = pathname.slice("/api/draws/".length);
            let body: { content: string; sha: string };
            try { body = await getBody(req); } catch { errorResponse(res, 400, "Invalid JSON"); return; }
            if (typeof body.content !== "string" || !body.sha) {
              errorResponse(res, 400, "Missing required fields: content, sha"); return;
            }

            if (useReal) {
              const fullPath = `${drawsPath}/${relPath}`;
              const safeName = fullPath.split("/").pop()!;
              const file = await putGitHubFile(ghCfg, fullPath, body.content, `Update: ${safeName}`, body.sha);
              jsonResponse(res, 200, { file, content: body.content });
            } else {
              const storePath = `draws/${relPath}`;
              const existing = mockStore.get(storePath);
              if (!existing) { errorResponse(res, 404, "File not found", "NOT_FOUND"); return; }
              if (existing.file.sha !== body.sha) { errorResponse(res, 409, "SHA mismatch", "CONFLICT"); return; }
              const updated: DiagramFile = { ...existing.file, sha: `sha-${Date.now()}`, lastModified: new Date().toISOString(), size: body.content.length };
              mockStore.set(storePath, { file: updated, content: body.content });
              jsonResponse(res, 200, { file: updated, content: body.content });
            }
            return;
          }

          // ---------------------------------------------------------------
          // DELETE /api/draws/* — delete file
          // ---------------------------------------------------------------
          if (method === "DELETE" && pathname.startsWith("/api/draws/")) {
            const relPath = pathname.slice("/api/draws/".length);
            let body: { sha: string };
            try { body = await getBody(req); } catch { errorResponse(res, 400, "Invalid JSON"); return; }
            if (!body.sha) { errorResponse(res, 400, "Missing required field: sha"); return; }

            if (useReal) {
              const fullPath = `${drawsPath}/${relPath}`;
              const safeName = fullPath.split("/").pop()!;
              await deleteGitHubFile(ghCfg, fullPath, body.sha, `Delete: ${safeName}`);
              res.statusCode = 204;
              res.end();
            } else {
              const storePath = `draws/${relPath}`;
              const existing = mockStore.get(storePath);
              if (!existing) { errorResponse(res, 404, "File not found", "NOT_FOUND"); return; }
              if (existing.file.sha !== body.sha) { errorResponse(res, 409, "SHA mismatch", "CONFLICT"); return; }
              mockStore.delete(storePath);
              res.statusCode = 204;
              res.end();
            }
            return;
          }

          errorResponse(res, 405, `Method not allowed: ${method} ${pathname}`);
        } catch (err: any) {
          console.error(`[dev-draws] error:`, err.message);
          if (err.status === 409) errorResponse(res, 409, "Conflict", "CONFLICT");
          else if (err.status === 404) errorResponse(res, 404, "Not found", "NOT_FOUND");
          else errorResponse(res, 500, "Internal error", "UNKNOWN");
        }
      });
    },
  };
};
