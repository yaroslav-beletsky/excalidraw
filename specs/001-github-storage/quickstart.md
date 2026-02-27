# Quickstart: GitHub Storage for Diagrams

**Feature**: `001-github-storage`
**Date**: 2026-02-26

---

## Prerequisites

1. Auth feature already implemented (branch `001-github-storage` already has it).
2. Authentik Forward Auth configured in Nginx — `X-User` header trusted.
3. A GitHub Personal Access Token with `repo` scope targeting `inspark-me/docs`.

---

## Environment Setup

### Production (`excalidraw-app/server.js`)

Add to your Docker Compose or Kubernetes env:

```env
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=inspark-me
GITHUB_REPO=docs
GITHUB_BRANCH=main
GITHUB_DRAWS_PATH=draws
```

### Development

Add to `excalidraw-app/.env.development.local` (git-ignored):

```env
VITE_APP_GITHUB_MOCK=true
```

When `VITE_APP_GITHUB_MOCK=true`, the Vite dev server middleware intercepts
`/api/draws/*` requests and returns mock data, so you don't need a real token
or repository during development.

---

## Source Code Layout

```
excalidraw-app/
├── server.js                    ← Extended with /api/draws/* endpoints
├── github/
│   ├── types.ts                 ← DiagramFile, DiagramFolder, SaveState, etc.
│   ├── atoms.ts                 ← Jotai: diagramTreeAtom, activeDiagramAtom, saveStateAtom
│   ├── useDraws.ts              ← Hook: list, open, save, create, delete
│   └── sanitize.ts              ← Filename sanitization (FR-011)
├── server/
│   ├── dev-auth-middleware.ts   ← Existing dev auth mock (already implemented)
│   └── dev-draws-middleware.ts  ← New: mock /api/draws/* for local dev
└── components/
    ├── AppSidebar.tsx           ← Modified: add Files tab
    ├── FileBrowser/
    │   ├── FileBrowser.tsx      ← Main file tree component
    │   ├── FileBrowser.scss     ← Styles
    │   ├── FileNode.tsx         ← Single file/folder row
    │   └── SaveIndicator.tsx    ← Status badge (Saved/Saving/Unsaved)
    └── AppMainMenu.tsx          ← Modified: add New/Save/Save As/Open menu items
```

---

## Running Locally with Mock Data

```bash
# In .env.development (already exists)
VITE_APP_DEV_AUTH_MOCK=true   # already set
VITE_APP_GITHUB_MOCK=true     # add this

# Start dev server
yarn start:app
```

The mock middleware provides:
- A list of 3 sample `.excalidraw` files in `draws/`
- Load, save, create, delete all work against in-memory state
- Console logs for every operation

---

## Running Against Real GitHub

```bash
# In .env.development.local (git-ignored, create if needed)
GITHUB_PAT=ghp_...
GITHUB_OWNER=inspark-me
GITHUB_REPO=docs
GITHUB_BRANCH=main
GITHUB_DRAWS_PATH=draws

# Do NOT set VITE_APP_GITHUB_MOCK — leave it unset or false
yarn start:app
```

The Vite dev server will proxy `/api/draws/*` to the Express server running
in a separate process, or you can run `node excalidraw-app/server.js` manually.

---

## Docker Production Build

```bash
# Build
yarn build:app:docker

# Run with env vars
docker run -p 80:80 \
  -e GITHUB_PAT=ghp_... \
  -e GITHUB_OWNER=inspark-me \
  -e GITHUB_REPO=docs \
  -e GITHUB_BRANCH=main \
  -e GITHUB_DRAWS_PATH=draws \
  inspark-draw:latest
```

---

## Verifying the Feature Works

1. Open InsparkDraw — sidebar should show "Files" tab as default
2. Files tab shows the tree from `inspark-me/docs/draws/`
3. Click a file → canvas loads the diagram
4. Draw something → save indicator shows "Unsaved"
5. After 30 seconds or Ctrl+S → save indicator shows "Saving..." then "Saved"
6. Check `inspark-me/docs` repo → new commit with message `Update: {file} by {user}`

---

## Key Quality Gates

```bash
# TypeScript check (must pass before commit)
npx tsc --noEmit

# Build check
yarn build:app:docker
```
