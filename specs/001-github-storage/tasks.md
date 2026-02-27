# Tasks: GitHub Storage for Diagrams

**Input**: Design documents from `/specs/001-github-storage/`
**Branch**: `001-github-storage`
**Generated**: 2026-02-26

**Organization**: Tasks grouped by user story for independent implementation and testing.
**User Stories**: US1 Browse (P1), US2 Open (P1), US3 Save (P1), US4 Create (P2), US5 SaveAs (P2), US7 Status (P2), US6 Delete (P3)
**MVP Scope**: Setup + Foundational + US1 + US2 + US3 (can demo read/write to GitHub)

---

## Phase 0: Planning (Executor Assignment)

**Purpose**: Analyze tasks, assign executors, resolve research.

- [ ] P001 Analyze all tasks and identify required agent types and capabilities
- [ ] P002 Create missing agents using meta-agent-v3 (launch N calls in single message, 1 per agent), then ask user restart
- [ ] P003 Assign executors to all tasks: MAIN (trivial only), existing agents (100% match), or specific agent names
- [ ] P004 Resolve research tasks: simple (solve with tools now), complex (create prompts in research/)

**Rules**:
- **MAIN executor**: ONLY for trivial tasks (1-2 line fixes, simple imports, single npm install)
- **Existing agents**: ONLY if 100% capability match after thorough examination
- **Agent creation**: Launch all meta-agent-v3 calls in single message for parallel execution
- **After P002**: Must restart claude-code before proceeding to P003

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, create type definitions, atoms, helpers, and dev mock — required by all user stories.

**⚠️ CRITICAL**: All Phase 2+ tasks depend on this phase completing first.

- [ ] T001 Install `@octokit/rest` dependency in excalidraw-app: add to package.json devDependencies and run `yarn install`
- [ ] T002 [P] Create `excalidraw-app/github/types.ts` with DiagramFile, DiagramFolder, DiagramTreeItem, ActiveDiagram, SaveState, and API request/response shapes from data-model.md
- [ ] T003 [P] Create `excalidraw-app/github/sanitize.ts` with `sanitizeFilename(input: string): string` — allows `[a-zA-Z0-9\-_./]`, replaces others with `-`, strips leading/trailing dots/slashes, appends `.excalidraw` if missing
- [ ] T004 [P] Create `excalidraw-app/github/atoms.ts` with Jotai atoms: `diagramTreeAtom`, `treeLoadingAtom`, `activeDiagramAtom`, `saveStateAtom` — import from `../app-jotai` per existing project pattern
- [ ] T005 [P] Create `excalidraw-app/server/dev-draws-middleware.ts` — Vite plugin that intercepts `/api/draws*` requests with in-memory mock data (3 sample files + folders, supports GET list, GET file, POST create, PUT update, DELETE)
- [ ] T006 Add `VITE_APP_GITHUB_MOCK` flag to `.env.development` (commented off by default) and `excalidraw-app/vite-env.d.ts` type declaration
- [ ] T007 Wire `devDrawsMiddleware` in `excalidraw-app/vite.config.mts` — add conditional plugin load (same pattern as `devAuthMiddleware`), pass env vars

**Checkpoint**: Run `npx tsc --noEmit` — should see no errors in new files.

---

## Phase 2: Foundational (Server API + Client Hook)

**Purpose**: Server-side GitHub gateway and client fetch hook — MUST complete before any UI user story.

**⚠️ CRITICAL**: All UI user stories (Phase 3+) depend on these. No UI work can begin until T008 and T009 are complete.

- [ ] T008 Implement `/api/draws/*` REST endpoints in `excalidraw-app/server.js` using `@octokit/rest`:
  - Initialize Octokit with `GITHUB_PAT` env var
  - `GET /api/draws` → `octokit.repos.getContent()` on `GITHUB_DRAWS_PATH`, recurse into subfolders, return nested DiagramTreeItem[] (only `.excalidraw` files)
  - `GET /api/draws/*` → `octokit.repos.getContent()`, decode base64 content, return FileResponse
  - `POST /api/draws` → `octokit.repos.createOrUpdateFileContents()`, sanitize filename, commit message `Create: {filename} by {X-User header}`
  - `PUT /api/draws/*` → `octokit.repos.createOrUpdateFileContents()` with SHA, commit message `Update: {filename} by {X-User header}`, 409 on SHA mismatch
  - `DELETE /api/draws/*` → `octokit.repos.deleteFile()` with SHA, commit message `Delete: {filename} by {X-User header}`
  - Read `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `GITHUB_DRAWS_PATH` from `process.env`
  - Handle 404, 409, 429 (rate limit with `retryAfter`), 500 per contracts/draws.yaml ApiError shape

- [ ] T009 Create `excalidraw-app/github/useDraws.ts` — custom React hook exposing:
  - `listDraws(): Promise<DiagramTreeItem[]>` — GET /api/draws, updates diagramTreeAtom
  - `openDraw(path: string): Promise<void>` — GET /api/draws/{path}, updates activeDiagramAtom
  - `saveDraw(): Promise<void>` — PUT /api/draws/{path} with current SHA from activeDiagramAtom, updates atom with new SHA
  - `createDraw(path: string, content: string): Promise<void>` — POST /api/draws
  - `deleteDraw(path: string, sha: string): Promise<void>` — DELETE /api/draws/{path}
  - Update `saveStateAtom` to `saving`/`saved`/`error`/`conflict` states at each step
  - Use native browser `fetch` only (no Octokit on client — FR-012)

**Checkpoint**: `curl http://localhost:3001/api/draws` (with VITE_APP_GITHUB_MOCK=true) returns mock file tree.

---

## Phase 3: US1 + US2 — Browse & Open Diagrams (Priority: P1) 🎯 MVP

**Goal**: Sidebar "Files" tab shows the full diagram tree. Clicking a file loads it on the canvas.

**Independent Test**: Open InsparkDraw → sidebar "Files" tab visible → tree shows mock/real files → click a file → canvas loads the diagram.

- [ ] T010 [P] [US1] Create `excalidraw-app/components/FileBrowser/FileBrowser.scss` — styles for tree container, file/folder rows (indent levels), hover/active states, empty state, loading spinner, timestamps. Use existing CSS variables (`--color-primary`, `--popup-bg-color`, etc.)

- [ ] T011 [P] [US1] Create `excalidraw-app/components/FileBrowser/FileNode.tsx` — single recursive file/folder row:
  - Props: `item: DiagramTreeItem`, `depth: number`, `activeFilePath: string | null`, `onFileClick: (file: DiagramFile) => void`
  - Folder: expand/collapse toggle with chevron icon, renders children recursively
  - File: shows name, last-modified date (relative: "2h ago"), click → `onFileClick`
  - Active file: highlighted with primary color
  - All state local (expanded) — no Jotai needed here

- [ ] T012 [US1] Create `excalidraw-app/components/FileBrowser/FileBrowser.tsx` — main tree container:
  - Reads `diagramTreeAtom`, `treeLoadingAtom`, `activeDiagramAtom` via Jotai
  - Calls `listDraws()` on mount (from useDraws)
  - Renders: loading spinner → error state → empty state ("No diagrams yet. Create one!") → tree of FileNode
  - Passes `onFileClick` → calls `openDraw(file.path)` from useDraws (depends on T011)

- [ ] T013 [US1] [US2] Extend `excalidraw-app/components/AppSidebar.tsx` to add "Files" tab as the default tab:
  - Wrap existing content in `Sidebar.Tabs` with `defaultTab="__files"`
  - Add `Sidebar.TabTrigger tab="__files"` → label "Files"
  - Add `Sidebar.Tab tab="__files"` → renders `<FileBrowser />`
  - Keep existing library tab as second tab
  - Import FileBrowser (depends on T012)

**Checkpoint**: Sidebar has "Files" tab. Tree renders from mock data. Clicking a file calls openDraw().

---

## Phase 4: US3 + US7 — Save & Status Indicator (Priority: P1 / P2)

**Goal**: Canvas changes auto-save to GitHub after 30s inactivity. Status badge shows saved/saving/unsaved/error.

**Independent Test**: Make a change → badge shows "Unsaved" → wait 30s → badge shows "Saving..." then "Saved" → check GitHub for new commit.

- [ ] T014 [US7] Create `excalidraw-app/components/FileBrowser/SaveIndicator.tsx` — status badge component:
  - Reads `saveStateAtom` from Jotai
  - Renders: `idle` → nothing, `saved` → "✓ Saved" (green), `unsaved` → "● Unsaved" (amber), `saving` → "↑ Saving..." (spinner), `error` → "✗ {message}" (red), `conflict` → "⚠ Conflict" (orange)
  - Small inline pill, suitable for toolbar or footer placement

- [ ] T015 [US3] [US7] Wire auto-save in `excalidraw-app/App.tsx`:
  - Import `useDraws`, `saveStateAtom`, `activeDiagramAtom`
  - In `onChange` callback: if `activeDiagram` is set, set saveState to `unsaved`, call `debouncedSave` (debounce 30s from `@excalidraw/common`)
  - On Ctrl+S / Cmd+S: call `saveDraw()` immediately (bypass debounce)
  - Import and render `<SaveIndicator />` in the `renderTopRightUI` area or footer

- [ ] T016 [US7] Render `<SaveIndicator />` in `excalidraw-app/components/AppFooter.tsx` — add to the right side of the footer toolbar alongside existing footer items

**Checkpoint**: Editing triggers "Unsaved" badge. 30s later: "Saving..." then "Saved". GitHub shows commit.

---

## Phase 5: US4 + US5 — Create New & Save As (Priority: P2)

**Goal**: Users can create new diagrams with a name dialog and save copies under new names.

**Independent Test**: Click "New Diagram" → enter name "test-arch" → blank canvas → save → file appears in sidebar and GitHub.

- [ ] T017 [US4] Create `excalidraw-app/components/NewDiagramDialog.tsx` — modal dialog:
  - Input field for diagram name (placeholder: "e.g. architecture")
  - Live preview of sanitized filename: "→ draws/{sanitized}.excalidraw"
  - Validates via `sanitizeFilename()` from `excalidraw-app/github/sanitize.ts`
  - "Create" button → calls `createDraw(path, emptyContent)` from useDraws → closes dialog
  - Reuse existing Radix UI Dialog pattern from project (same as Popover in UserProfileButton)

- [ ] T018 [US4] [US5] Extend `excalidraw-app/components/AppMainMenu.tsx` to add file management items:
  - "New Diagram" → opens NewDiagramDialog
  - "Save" → calls `saveDraw()` immediately (skip debounce)
  - "Save As..." → opens NewDiagramDialog in "save as" mode (pre-fills with current name, saves copy)
  - Items only shown when auth is available (`authUserAtom`)

**Checkpoint**: "New Diagram" creates file in GitHub. "Save As" saves copy. Both appear in sidebar.

---

## Phase 6: US6 — Delete Diagram (Priority: P3)

**Goal**: Right-click (or kebab menu) on a file in the sidebar offers Delete with confirmation.

**Independent Test**: Right-click a file → "Delete" → confirm → file removed from sidebar and GitHub (commit created).

- [ ] T019 [US6] Add context menu to `excalidraw-app/components/FileBrowser/FileNode.tsx`:
  - Right-click on file row → Radix UI ContextMenu with "Delete" option (red)
  - On "Delete" click → show inline confirmation: "Delete {filename}? This cannot be undone." + Cancel/Delete buttons
  - On confirm → calls `deleteDraw(file.path, file.sha)` from useDraws → refreshes tree

**Checkpoint**: Right-click file → context menu → delete → gone from sidebar → GitHub commit visible.

---

## Phase 7: Conflict & Error Handling (FR-010, FR-014, FR-015)

**Purpose**: Cross-cutting safety mechanisms — users never lose work, conflicts always surfaced.

- [ ] T020 Implement unsaved changes guard in `excalidraw-app/App.tsx` (FR-014):
  - Before `openDraw()`: if `saveState === "unsaved"`, show confirm dialog "You have unsaved changes. Discard and open {filename}?" → Cancel/Discard
  - Before clearing canvas (New Diagram): same guard
  - Wire into FileNode's `onFileClick` and NewDiagramDialog's open action

- [ ] T021 Implement conflict dialog in `excalidraw-app/App.tsx` (FR-010):
  - When `saveDraw()` returns conflict error (409/SHA mismatch): set `saveState` to `conflict`
  - Show dialog: "This diagram was modified by someone else. What would you like to do?" + "Reload latest" / "Save anyway (overwrite)"
  - "Reload latest" → call `openDraw()` to fetch fresh version
  - "Save anyway" → call `saveDraw()` without SHA (force create new commit)

- [ ] T022 Add error toast notifications (FR-015):
  - On rate limit (429): toast "GitHub API rate limit exceeded. Retry in {N} minutes."
  - On auth error (401/403): toast "GitHub authentication error — contact administrator."
  - On network failure: toast "Could not reach server. Changes saved locally."
  - Use existing toast/notification pattern from the project (check `excalidraw-app/App.tsx` for existing patterns)

---

## Phase 8: Polish & Quality Gates

**Purpose**: TypeScript compliance, build validation, dev workflow completeness.

- [ ] T023 [P] Run `npx tsc --noEmit` from repo root, fix all TypeScript errors in new files (`excalidraw-app/github/`, `excalidraw-app/components/FileBrowser/`, modified files)

- [ ] T024 [P] Run `yarn build:app:docker` — fix any Vite/Rollup build errors, ensure no circular imports, chunk sizes acceptable

- [ ] T025 Update `specs/001-github-storage/plan.md` Design Artifacts table: change Tasks row from "⏳ Pending" to "✅ Complete"

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)       → no deps, start immediately
Phase 2 (Foundational) → depends on Phase 1 complete (T001–T007)
Phase 3 (US1+US2)     → depends on Phase 2 (T008, T009)
Phase 4 (US3+US7)     → depends on Phase 2 (T008, T009) + Phase 3 sidebar (T013)
Phase 5 (US4+US5)     → depends on Phase 2 (T009) + Phase 3 sidebar (T013)
Phase 6 (US6)         → depends on Phase 2 (T009) + Phase 3 FileNode (T011)
Phase 7 (Conflict)    → depends on Phase 2-4 complete
Phase 8 (Polish)      → depends on all phases
```

### Within-Phase Dependencies

```
Phase 1:  T001 → T002-T007 can run in parallel (different files)
Phase 2:  T008 → T009 (hook uses types from T002, T008 defines API shape)
Phase 3:  T010,T011 [P] → T012 → T013
Phase 4:  T014 [P] → T015 → T016
Phase 5:  T017 → T018
Phase 7:  T020 → T021 → T022 (all touch App.tsx, must be sequential)
```

### Parallel Opportunities

```bash
# Phase 1: Run all together after T001
Task: T002 Create types.ts
Task: T003 Create sanitize.ts
Task: T004 Create atoms.ts
Task: T005 Create dev-draws-middleware.ts

# Phase 3: Run together
Task: T010 Create FileBrowser.scss
Task: T011 Create FileNode.tsx

# Phase 8: Run together
Task: T023 TypeScript check
Task: T024 Build check
```

---

## Implementation Strategy

### MVP First (Stories 1+2+3)

1. Phase 1: Setup → Phase 2: Foundational → Phase 3: Browse+Open → Phase 4: Save+Status
2. **STOP and VALIDATE**: Can browse, open, and save real diagrams to GitHub
3. Demo to team

### Full Feature Delivery

1. MVP first (Phases 1-4)
2. Phase 5: Create+SaveAs → Phase 6: Delete
3. Phase 7: Conflict+Error handling
4. Phase 8: Polish

---

## Notes

- `[P]` = different files, safe to run in parallel
- `[USN]` = maps to User Story N in spec.md
- Server env vars (`GITHUB_PAT`, etc.) are `process.env` — never sent to browser
- Dev mock (`VITE_APP_GITHUB_MOCK=true`) makes all API calls work without a real GitHub token
- Commit after each completed task (1 task = 1 commit)
- TypeScript check must pass before each commit
