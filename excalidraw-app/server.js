const express = require("express");
const path = require("path");
const { Octokit } = require("@octokit/rest");

const app = express();
const PORT = process.env.PORT || 80;
const buildDir = path.join(__dirname, "build");

const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
const GITHUB_OWNER = process.env.GITHUB_OWNER || "inspark-me";
const GITHUB_REPO = process.env.GITHUB_REPO || "docs";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_DRAWS_PATH = process.env.GITHUB_DRAWS_PATH || "draws";

function sanitizeFilename(input) {
  let name = input
    .replace(/[^a-zA-Z0-9\-_./]/g, "-")
    .replace(/^[./]+/, "")
    .replace(/[./]+$/, "")
    .replace(/-{2,}/g, "-");
  if (!name) name = "untitled";
  if (!name.endsWith(".excalidraw")) name = `${name}.excalidraw`;
  return name;
}

async function buildDrawsTree(path) {
  const { data } = await octokit.repos.getContent({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    ref: GITHUB_BRANCH,
    path,
  });

  if (!Array.isArray(data)) return [];

  const items = [];
  for (const item of data) {
    if (item.type === "dir") {
      const children = await buildDrawsTree(item.path);
      items.push({ type: "folder", name: item.name, path: item.path, children });
    } else if (item.type === "file" && item.name.endsWith(".excalidraw")) {
      // Get commit info for lastModified/lastModifiedBy
      let lastModified = new Date().toISOString();
      let lastModifiedBy = "unknown";
      try {
        const commits = await octokit.repos.listCommits({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          sha: GITHUB_BRANCH,
          path: item.path,
          per_page: 1,
        });
        if (commits.data.length > 0) {
          lastModified = commits.data[0].commit.committer.date;
          lastModifiedBy = commits.data[0].commit.author.name || commits.data[0].author?.login || "unknown";
        }
      } catch (_) {}
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

// Auth endpoint — reads headers from Authentik (forwarded by nginx)
app.get("/api/auth/me", (req, res) => {
  const username = req.headers["x-user"];
  if (!username) {
    return res.json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    username,
    email: req.headers["x-email"] || "",
    name: req.headers["x-name"] || "",
    groups: (req.headers["x-groups"] || "").split(",").filter(Boolean),
    avatarUrl: req.headers["x-avatar"] || null,
  });
});

app.use(express.json());

// GET /api/draws — list all diagrams as a tree
app.get("/api/draws", async (req, res) => {
  try {
    const tree = await buildDrawsTree(GITHUB_DRAWS_PATH);
    res.json(tree);
  } catch (err) {
    if (err.status === 404) {
      res.json([]); // draws/ folder doesn't exist yet
    } else if (err.status === 403 && err.response?.headers?.["x-ratelimit-remaining"] === "0") {
      const retryAfter = parseInt(err.response.headers["x-ratelimit-reset"]) - Math.floor(Date.now() / 1000);
      res.status(429).json({ error: "GitHub API rate limit exceeded", code: "RATE_LIMITED", retryAfter });
    } else {
      console.error("[draws] list error:", err.message);
      res.status(500).json({ error: "Internal server error", code: "UNKNOWN" });
    }
  }
});

// GET /api/draws/* — get file content
app.get("/api/draws/*", async (req, res) => {
  const filePath = `${GITHUB_DRAWS_PATH}/${req.params[0]}`;
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      ref: GITHUB_BRANCH,
      path: filePath,
    });
    if (Array.isArray(data)) {
      return res.status(404).json({ error: "Path is a directory, not a file", code: "NOT_FOUND" });
    }
    const content = Buffer.from(data.content, "base64").toString("utf-8");
    res.json({
      file: { type: "file", name: data.name, path: data.path, sha: data.sha, lastModified: new Date().toISOString(), lastModifiedBy: "unknown", size: data.size },
      content,
    });
  } catch (err) {
    if (err.status === 404) res.status(404).json({ error: "File not found", code: "NOT_FOUND" });
    else res.status(500).json({ error: "Internal server error", code: "UNKNOWN" });
  }
});

// POST /api/draws — create a new diagram
app.post("/api/draws", async (req, res) => {
  const { path: rawPath, content } = req.body;
  const username = req.headers["x-user"] || "unknown";
  if (!rawPath || content === undefined) {
    return res.status(400).json({ error: "path and content are required" });
  }
  const sanitizedName = sanitizeFilename(rawPath);
  const filePath = `${GITHUB_DRAWS_PATH}/${sanitizedName}`;
  const message = `Create: ${sanitizedName} by ${username}`;
  try {
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH,
      path: filePath,
      message,
      content: Buffer.from(content).toString("base64"),
    });
    res.status(201).json({
      file: { type: "file", name: sanitizedName, path: filePath, sha: data.content.sha, lastModified: new Date().toISOString(), lastModifiedBy: username, size: Buffer.byteLength(content) },
      content,
    });
  } catch (err) {
    if (err.status === 422) res.status(409).json({ error: `File already exists at ${filePath}`, code: "CONFLICT" });
    else res.status(500).json({ error: "Internal server error", code: "UNKNOWN" });
  }
});

// PUT /api/draws/* — update an existing diagram
app.put("/api/draws/*", async (req, res) => {
  const filePath = `${GITHUB_DRAWS_PATH}/${req.params[0]}`;
  const { content, sha, message: customMessage } = req.body;
  const username = req.headers["x-user"] || "unknown";
  const filename = filePath.split("/").pop();
  if (!content || !sha) {
    return res.status(400).json({ error: "content and sha are required" });
  }
  const message = customMessage || `Update: ${filename} by ${username}`;
  try {
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH,
      path: filePath,
      message,
      content: Buffer.from(content).toString("base64"),
      sha,
    });
    res.json({
      file: { type: "file", name: filename, path: filePath, sha: data.content.sha, lastModified: new Date().toISOString(), lastModifiedBy: username, size: Buffer.byteLength(content) },
      content,
    });
  } catch (err) {
    if (err.status === 409) res.status(409).json({ error: "Conflict: file was modified by another user", code: "CONFLICT" });
    else if (err.status === 404) res.status(404).json({ error: "File not found", code: "NOT_FOUND" });
    else res.status(500).json({ error: "Internal server error", code: "UNKNOWN" });
  }
});

// DELETE /api/draws/* — delete a diagram
app.delete("/api/draws/*", async (req, res) => {
  const filePath = `${GITHUB_DRAWS_PATH}/${req.params[0]}`;
  const { sha } = req.body;
  const username = req.headers["x-user"] || "unknown";
  const filename = filePath.split("/").pop();
  if (!sha) {
    return res.status(400).json({ error: "sha is required" });
  }
  const message = `Delete: ${filename} by ${username}`;
  try {
    await octokit.repos.deleteFile({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH,
      path: filePath,
      message,
      sha,
    });
    res.status(204).end();
  } catch (err) {
    if (err.status === 409) res.status(409).json({ error: "Conflict: file was modified", code: "CONFLICT" });
    else if (err.status === 404) res.status(404).json({ error: "File not found", code: "NOT_FOUND" });
    else res.status(500).json({ error: "Internal server error", code: "UNKNOWN" });
  }
});

// Static files
app.use(express.static(buildDir));

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(buildDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`InsparkDraw server listening on :${PORT}`);
});
