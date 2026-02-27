# Phase 0 Research: GitHub Storage for Diagrams

**Feature**: `001-github-storage`
**Date**: 2026-02-26
**Status**: Complete

## Summary

GitHub Contents API (via Octokit) is the right library choice. Debounce and
state management are already available in the project. The existing sidebar
component can host a new "Files" tab without structural changes.

---

## Library Research

### GitHub API Client

**Decision: `@octokit/rest` v22.0.1** — server-side only (inside Express endpoints)

| Criterion | Result |
|-----------|--------|
| Weekly downloads | 27 million |
| Last release | v22.0.1 (2025) |
| TypeScript support | Full — ships its own types |
| Bundle impact | Server-only, no client bundle cost |
| Key feature | `repos.getContent`, `repos.createOrUpdateFileContents`, `repos.deleteFile` |

**Alternatives rejected**:

- **GitHub REST API via raw `fetch`**: Would require manual header management,
  error parsing, and pagination. Octokit handles all of this with typed
  responses. Not worth the complexity delta.

- **`@octokit/graphql`**: GraphQL API provides richer queries but does not
  support file content mutations. Would need REST anyway for writes. Rejected.

- **`isomorphic-git`**: Full git client — massive dependency (>1 MB), designed
  for browser git operations, far exceeds requirements. Rejected.

**Octokit key methods used**:

```
octokit.repos.getContent()      → FR-001, FR-002, FR-003
octokit.repos.createOrUpdateFileContents()  → FR-004, FR-005, FR-006
octokit.repos.deleteFile()      → FR-007
```

The SHA field returned by `getContent()` is used for FR-010 (conflict detection).

---

### Debounce for Auto-Save

**Decision: Use existing `debounce` from `@excalidraw/common`** — no new dependency

```ts
import { debounce } from "@excalidraw/common";
```

Already used in `excalidraw-app/App.tsx` and elsewhere. 30-second debounce
satisfies FR-009. No new package needed.

---

### State Management

**Decision: Jotai v2.11.0** — already in project dependencies

```ts
import { atom, useAtom, useAtomValue, useSetAtom } from "../app-jotai";
```

Consistent with existing patterns: `collabAPIAtom`, `authUserAtom`.
New atoms: `diagramTreeAtom`, `activeDiagramAtom`, `saveStateAtom`.

---

### UI Components

**Decision: Extend `DefaultSidebar` with new "Files" tab**

Current structure (`excalidraw-app/components/AppSidebar.tsx`):

```tsx
<DefaultSidebar>
  {/* existing content */}
</DefaultSidebar>
```

`DefaultSidebar` supports `Sidebar.Tabs`, `Sidebar.Tab`, `Sidebar.TabTrigger`
pattern (already used for Library tab). We add a "Files" tab alongside the
Library tab using the same API — zero structural changes to the sidebar.

**Folder tree UI**: Use native React with CSS indent — no tree library needed.
The `draws/` folder is team-internal, shallow depth (max 2-3 levels expected).
A simple recursive component with expand/collapse state is <50 lines.

---

## Architecture Decision: Server-Side Gateway

**FR-012 mandates**: GitHub PAT must never reach the client.

The existing Express server (`excalidraw-app/server.js`) already serves the
SPA and exposes `/api/auth/me`. We extend it with `/api/draws/*` endpoints.

```
Browser → GET /api/draws → Express → Octokit → GitHub API
                                          ↑
                             PAT in process.env (server-only)
                             Username from req.headers["x-user"] (Authentik)
```

**Commit message construction happens server-side**:

```
"Update: {sanitized-filename} by {x-user-header}"
```

The server reads `X-User` from the Authentik Forward Auth headers (same as
`/api/auth/me` already does). No additional trust boundary needed.

---

## Sidebar Integration: Tab Extension Pattern

Existing sidebar has a `__library` tab. We add `__files` tab.

```tsx
<DefaultSidebar>
  <Sidebar.Tabs defaultTab="__files">
    <Sidebar.TabTriggers>
      <Sidebar.TabTrigger tab="__files">Files</Sidebar.TabTrigger>
      <Sidebar.TabTrigger tab="__library">Library</Sidebar.TabTrigger>
    </Sidebar.TabTriggers>
    <Sidebar.Tab tab="__files">
      <FileBrowser />
    </Sidebar.Tab>
    <Sidebar.Tab tab="__library">
      {/* existing library content */}
    </Sidebar.Tab>
  </Sidebar.Tabs>
</DefaultSidebar>
```

`FileBrowser` component is a new standalone component with its own SCSS.

---

## Save Flow

```
onChange (Excalidraw) → debounce(30s) → saveDiagram()
                                              ↓
                                   PUT /api/draws/{path}
                                   body: { content, sha, message }
                                              ↓
                                   Octokit.createOrUpdateFileContents()
                                              ↓
                              response includes new SHA → update activeDiagram.sha
```

The SHA round-trip is critical for FR-010 (concurrent conflict detection).
If PUT returns 409, the server forwards this as a conflict error to the client.

---

## Decisions Not Researched (Out of Scope for Phase 0)

- **Offline queue**: Phase 2+ feature. The spec says "retry when connectivity
  restored" — deferred until after P1/P2 stories are implemented.
- **MCP server**: Separate feature, separate spec.
- **Online collaboration**: Separate feature, separate spec.
