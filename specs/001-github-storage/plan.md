# Implementation Plan: GitHub Storage for Diagrams

**Branch**: `001-github-storage` | **Date**: 2026-02-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-github-storage/spec.md`

## Summary

Store InsparkDraw diagrams in the `inspark-me/docs` GitHub repository
(`branch: main`, `folder: draws/`) via a secure server-side proxy. The Express
server holds a GitHub PAT and exposes `/api/draws/*` REST endpoints that wrap
Octokit's Contents API. The frontend adds a "Files" tab to the existing sidebar
with a recursive file tree, open/save/create/delete UI, and a save status
indicator. Auto-save uses the existing `debounce` utility. Conflict detection
uses the Git blob SHA round-trip built into the GitHub Contents API.

---

## Technical Context

**Language/Version**: TypeScript (strict) + Node.js 18
**Primary Dependencies**: React 18, Vite 5, Jotai v2.11, `@octokit/rest` v22 (server), `@excalidraw/common` (debounce, client)
**Storage**: GitHub Contents API (`inspark-me/docs`, branch `main`, folder `draws/`)
**Testing**: Vitest + @testing-library/react (existing project setup)
**Target Platform**: Self-hosted via Docker (nginx → node:18-alpine already migrated)
**Project Type**: Web application (monorepo: `packages/` + `excalidraw-app/`)
**Performance Goals**: List <2s, Open <3s, Save <5s (SC-001, SC-002, SC-003)
**Constraints**: PAT server-side only (FR-012), no new client-side GitHub SDK
**Scale/Scope**: Team <50 users, <5000 GitHub API req/hour (within free tier)

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Self-Hosted First**: All GitHub operations server-side, no third-party SaaS added
- [x] **Simplest Correct Design**: Octokit on server, native fetch on client, no new client libraries
- [x] **TypeScript Strict**: All new types in `github/types.ts`, strict mode already enabled
- [x] **No New Client Libraries**: Using existing `debounce` from `@excalidraw/common` and Jotai
- [x] **No PAT to Client**: Express gateway pattern enforces FR-012
- [x] **Authentik Trust Model**: `X-User` header read server-side, same as `/api/auth/me`
- [x] **Quality Gates Pass**: `npx tsc --noEmit` and `yarn build:app:docker` required before merge

---

## Project Structure

### Documentation (this feature)

```text
specs/001-github-storage/
├── plan.md              # This file
├── research.md          # Phase 0: Library decisions
├── data-model.md        # Phase 1: Entity shapes and Jotai atoms
├── quickstart.md        # Phase 1: Dev setup and verification
├── contracts/
│   └── draws.yaml       # Phase 1: OpenAPI 3.1 contract for /api/draws/*
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code Layout

```text
excalidraw-app/
├── server.js                         # Modified: add /api/draws/* endpoints (Octokit)
├── .env.development                  # Modified: add VITE_APP_GITHUB_MOCK=true flag
├── vite-env.d.ts                     # Modified: add VITE_APP_GITHUB_MOCK type
├── vite.config.mts                   # Modified: add devDrawsMiddleware plugin
│
├── github/                           # NEW directory — all GitHub storage logic
│   ├── types.ts                      # DiagramFile, DiagramFolder, DiagramTreeItem, SaveState, ActiveDiagram
│   ├── atoms.ts                      # Jotai: diagramTreeAtom, activeDiagramAtom, saveStateAtom
│   ├── useDraws.ts                   # Hook: listDraws, openDraw, saveDraw, createDraw, deleteDraw
│   └── sanitize.ts                   # sanitizeFilename() for FR-011
│
├── server/
│   ├── dev-auth-middleware.ts        # Existing — unchanged
│   └── dev-draws-middleware.ts       # NEW — mock /api/draws/* for local dev
│
├── components/
│   ├── AppSidebar.tsx                # Modified: add Files tab with FileBrowser
│   ├── AppMainMenu.tsx               # Modified: add New/Save/Save As/Open items
│   ├── AppFooter.tsx                 # Modified: add SaveIndicator (or inline in footer)
│   ├── FileBrowser/
│   │   ├── FileBrowser.tsx           # NEW — main tree component
│   │   ├── FileBrowser.scss          # NEW — styles
│   │   ├── FileNode.tsx              # NEW — single file/folder row with context menu
│   │   └── SaveIndicator.tsx         # NEW — saved/saving/unsaved/error badge
│   └── NewDiagramDialog.tsx          # NEW — name entry dialog (FR-005, FR-011)
│
└── App.tsx                           # Modified: wire useDraws auto-save + conflict dialog
```

**Structure Decision**: Single web application (`excalidraw-app/`). New code
is isolated in `excalidraw-app/github/` to keep GitHub concerns separate from
the core Excalidraw logic. Server endpoints are co-located in `server.js`
(Express routes added inline — no need for a separate routes file at this scale).

---

## Complexity Tracking

No constitution violations. All choices use the simplest correct solution:

| Decision | Why This | Simpler Alternative Rejected Because |
|----------|----------|--------------------------------------|
| Express gateway for GitHub | FR-012 mandates no PAT to client | Direct browser Octokit would expose token |
| Server-side Octokit only | No browser bundle cost | Not needed client-side at all |
| Native browser `fetch` for client | Zero new dependencies | Octokit browser build adds 50KB unnecessarily |
| `@excalidraw/common` debounce | Already in project | External debounce lib would be redundant |
| Sidebar tab extension | Zero structural change | New sidebar would duplicate existing chrome |

---

## Implementation Phases

The tasks.md (generated by `/speckit.tasks`) will sequence these into atomic,
testable tasks with dependencies. High-level phase grouping:

### Phase A — Server Foundation (FR-012, FR-001–007, FR-013)

1. Add `@octokit/rest` to server dependencies in `package.json`
2. Extend `server.js` with `/api/draws` routes (list, get, create, update, delete)
3. Add filename sanitization helper (`github/sanitize.ts`)
4. Wire Authentik `X-User` header into commit messages

### Phase B — Client State (Data Model)

5. Create `excalidraw-app/github/types.ts`
6. Create `excalidraw-app/github/atoms.ts`
7. Create `excalidraw-app/github/useDraws.ts` hook

### Phase C — File Browser UI (US1, US2, FR-001–003)

8. Create `FileBrowser/FileBrowser.tsx` + recursive `FileNode.tsx`
9. Create `FileBrowser/FileBrowser.scss`
10. Extend `AppSidebar.tsx` with Files tab

### Phase D — Save & Status (US3, US7, FR-004, FR-008, FR-009)

11. Create `SaveIndicator.tsx`
12. Wire auto-save debounce in `App.tsx` (`onChange` → `useDraws.saveDraw`)
13. Add `SaveIndicator` to footer/header area

### Phase E — Create & Save As (US4, US5, FR-005–006, FR-011)

14. Create `NewDiagramDialog.tsx` with filename validation
15. Add New/Save As menu items to `AppMainMenu.tsx`
16. Wire create flow end-to-end

### Phase F — Conflict & Error Handling (FR-010, FR-014, FR-015)

17. Conflict dialog (SHA mismatch → offer reload or force-save)
18. Unsaved changes guard (FR-014 — confirm before open/new)
19. Error toasts for rate limits, auth errors, network failures

### Phase G — Delete (US6, FR-007)

20. Context menu on `FileNode` with Delete option
21. Confirmation dialog + delete API call + sidebar refresh

### Phase H — Dev Mock & Quality Gates

22. Create `dev-draws-middleware.ts` for local development
23. Add `VITE_APP_GITHUB_MOCK` to `.env.development` and `vite-env.d.ts`
24. Wire mock middleware in `vite.config.mts`
25. `npx tsc --noEmit` passes, `yarn build:app:docker` passes

---

## Design Artifacts

| Artifact | Status | Path |
|----------|--------|------|
| Feature Spec | ✅ Complete | [spec.md](spec.md) |
| Spec Checklist | ✅ All pass | [checklists/requirements.md](checklists/requirements.md) |
| Phase 0 Research | ✅ Complete | [research.md](research.md) |
| Data Model | ✅ Complete | [data-model.md](data-model.md) |
| API Contracts | ✅ Complete | [contracts/draws.yaml](contracts/draws.yaml) |
| Quickstart | ✅ Complete | [quickstart.md](quickstart.md) |
| Tasks | ✅ Complete | [tasks.md](tasks.md) |
| Implementation | ✅ Complete | All 25 tasks done, build passes |
