# Feature Specification: GitHub Storage for Diagrams

**Feature Branch**: `001-github-storage`
**Created**: 2026-02-26
**Status**: Draft
**Input**: User description: "GitHub Storage — store InsparkDraw diagrams in
GitHub repo inspark-me/docs (branch main, folder draws/). CRUD via GitHub
API. Server: Express API endpoints. Frontend: file browser sidebar with repo
tree, New/Open/Save/Save As, auto-save with debounce → commit. Each save =
commit. Auth via Authentik (already done). GitHub PAT server-side only."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Existing Diagrams (Priority: P1)

As a team member, I open InsparkDraw and see a list of all shared diagrams
stored in the team repository. I can browse the tree, see file names and
last-modified dates, and quickly find the diagram I need.

**Why this priority**: Without browsing, users cannot discover or open any
existing work. This is the foundation for all other interactions.

**Independent Test**: Can be fully tested by opening InsparkDraw and verifying
the sidebar shows the correct list of `.excalidraw` files from the repository.
Delivers immediate value: team visibility into shared diagrams.

**Acceptance Scenarios**:

1. **Given** the user is authenticated and the sidebar is open,
   **When** the page loads,
   **Then** the sidebar displays a tree of all `.excalidraw` files from
   the `draws/` folder in the repository, showing file names and
   last-modified timestamps.

2. **Given** the repository contains files in nested subfolders under
   `draws/`,
   **When** the user views the sidebar,
   **Then** the tree structure reflects the folder hierarchy with
   expandable/collapsible folders.

3. **Given** the repository is empty (no files in `draws/`),
   **When** the user views the sidebar,
   **Then** an empty state message is shown with a prompt to create a
   new diagram.

---

### User Story 2 - Open a Diagram (Priority: P1)

As a team member, I click on a diagram in the file browser and it loads
onto the canvas, replacing the current content (with confirmation if
unsaved changes exist).

**Why this priority**: Opening files is the core read operation. Together
with browsing (US1), this forms the minimum viable product.

**Independent Test**: Can be tested by clicking a file in the sidebar and
verifying the canvas shows the correct diagram content.

**Acceptance Scenarios**:

1. **Given** the user sees the file list,
   **When** they click on a diagram file,
   **Then** the diagram loads onto the canvas within 3 seconds.

2. **Given** the user has unsaved changes on the canvas,
   **When** they click on a different file,
   **Then** a confirmation dialog asks whether to save, discard, or cancel.

3. **Given** the user opens a file that has been deleted or moved,
   **When** the load fails,
   **Then** a clear error message is shown and the sidebar refreshes.

---

### User Story 3 - Save a Diagram (Priority: P1)

As a team member, I work on a diagram and save it. The save creates a
commit in the repository with my name in the commit message, so the team
can see who changed what.

**Why this priority**: Save is the core write operation. Without it,
no work can be persisted to the shared repository.

**Independent Test**: Can be tested by modifying a diagram, clicking save,
and verifying a new commit appears in the repository with the correct
file content and commit message.

**Acceptance Scenarios**:

1. **Given** the user has a diagram open (previously saved file),
   **When** they save,
   **Then** the file is updated in the repository with a commit message
   "Update: {filename} by {username}" and the save indicator shows
   "Saved".

2. **Given** the user has made changes,
   **When** auto-save triggers (after a period of inactivity),
   **Then** the diagram is saved automatically with the same commit
   format.

3. **Given** the save fails (network error, token expired),
   **When** the error occurs,
   **Then** the user sees an error notification, the indicator shows
   "Unsaved", and the changes remain in local state so no work is lost.

---

### User Story 4 - Create a New Diagram (Priority: P2)

As a team member, I create a new diagram from InsparkDraw. I give it
a name, and it is saved as a new file in the repository.

**Why this priority**: Creating new diagrams is essential but slightly
lower priority than opening and saving existing ones. The app already
supports creating blank canvases locally.

**Independent Test**: Can be tested by clicking "New", entering a name,
drawing something, saving, and verifying the file appears in the
repository and in the sidebar.

**Acceptance Scenarios**:

1. **Given** the user clicks "New Diagram",
   **When** they enter a file name (e.g., "architecture"),
   **Then** a blank canvas is created and the file path is set to
   `draws/{name}.excalidraw`.

2. **Given** the user tries to create a file with a name that already
   exists,
   **When** they confirm the name,
   **Then** the system warns about the conflict and asks to choose a
   different name or overwrite.

3. **Given** the user enters a name with special characters,
   **When** they confirm,
   **Then** the name is sanitized to a valid filename (alphanumeric,
   hyphens, underscores).

---

### User Story 5 - Save As / Rename (Priority: P2)

As a team member, I save a copy of the current diagram under a new name,
or save it into a subfolder.

**Why this priority**: Useful for creating variations or organizing
diagrams, but not critical for the initial workflow.

**Independent Test**: Can be tested by opening a diagram, choosing
"Save As", entering a new name, and verifying both the original and
the copy exist in the repository.

**Acceptance Scenarios**:

1. **Given** the user has a diagram open,
   **When** they choose "Save As" and enter a new name,
   **Then** the diagram is saved as a new file, the original remains
   unchanged, and the sidebar now shows both files.

2. **Given** the user enters a path with a subfolder (e.g.,
   "architecture/v2"),
   **When** they save,
   **Then** the subfolder is created if it doesn't exist and the file
   is saved there.

---

### User Story 6 - Delete a Diagram (Priority: P3)

As a team member, I delete a diagram I no longer need. The deletion
creates a commit in the repository.

**Why this priority**: Deletion is a housekeeping feature. Less
frequent than create/read/update operations.

**Independent Test**: Can be tested by right-clicking a file, choosing
"Delete", confirming, and verifying the file is removed from the
repository and the sidebar.

**Acceptance Scenarios**:

1. **Given** the user selects a file in the sidebar,
   **When** they choose "Delete" and confirm,
   **Then** the file is deleted from the repository with a commit
   message "Delete: {filename} by {username}" and removed from the
   sidebar.

2. **Given** the user is currently editing the file they want to delete,
   **When** they delete it,
   **Then** the canvas is cleared and the file is removed.

---

### User Story 7 - Save Status Indicator (Priority: P2)

As a team member, I always see whether my current work is saved,
saving, or has unsaved changes, so I never lose work.

**Why this priority**: Provides essential feedback for the save
workflow. Without it, users don't know if their changes are persisted.

**Independent Test**: Can be tested by observing the indicator in
different states: after loading (saved), after editing (unsaved),
during save (saving), after save (saved), after error (unsaved + error).

**Acceptance Scenarios**:

1. **Given** the diagram has no unsaved changes,
   **When** the user views the status,
   **Then** the indicator shows "Saved" (or a checkmark).

2. **Given** the user makes a change,
   **When** the change occurs,
   **Then** the indicator immediately switches to "Unsaved" (or a dot).

3. **Given** auto-save is in progress,
   **When** the save request is sent,
   **Then** the indicator shows "Saving..." (or a spinner).

---

### Edge Cases

- What happens when the GitHub API rate limit is exceeded?
  The system shows a warning and retries after the rate limit reset
  period. Local changes are preserved.

- What happens when two users save the same file simultaneously?
  The second save detects a SHA mismatch (file was modified since last
  fetch). The system notifies the user and offers to reload the latest
  version or force-save (overwrite).

- What happens when the GitHub PAT is invalid or expired?
  All API operations fail gracefully with a clear "Authentication
  error — contact administrator" message. No data is lost locally.

- What happens when the user is offline or the server is unreachable?
  The canvas continues to work locally. Save operations queue and
  retry when connectivity is restored.

- What happens when a file is too large for the GitHub Contents API
  (>100MB)?
  Excalidraw files are typically small (KBs to low MBs). If a file
  exceeds the limit, the save fails with a clear size warning.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST list all `.excalidraw` files from the
  `draws/` folder in the `inspark-me/docs` repository (branch `main`).
- **FR-002**: System MUST display files in a hierarchical tree
  reflecting the folder structure under `draws/`.
- **FR-003**: System MUST load a selected diagram onto the canvas
  by fetching its content from the repository.
- **FR-004**: System MUST save diagrams to the repository by creating
  commits with the message format "Update: {filename} by {username}".
- **FR-005**: System MUST support creating new `.excalidraw` files
  in the repository with user-provided names.
- **FR-006**: System MUST support "Save As" to create copies under
  new names or in subfolders.
- **FR-007**: System MUST support deleting files from the repository
  with confirmation and commit message "Delete: {filename} by
  {username}".
- **FR-008**: System MUST show a save status indicator with three
  states: saved, unsaved, saving.
- **FR-009**: System MUST auto-save diagrams after a configurable
  period of inactivity (default: 30 seconds after last change).
- **FR-010**: System MUST detect concurrent modification conflicts
  (SHA mismatch) and notify the user.
- **FR-011**: System MUST sanitize user-provided file names to valid
  filesystem characters.
- **FR-012**: System MUST never expose the GitHub access token to
  the client — all repository operations go through the server.
- **FR-013**: System MUST use the authenticated user's name
  (from Authentik) in commit messages.
- **FR-014**: System MUST prompt for confirmation before discarding
  unsaved changes (opening another file, creating new).
- **FR-015**: System MUST handle API errors gracefully with
  user-friendly messages and preserve local state.

### Key Entities

- **Diagram**: A drawing created in InsparkDraw. Stored as a
  `.excalidraw` JSON file. Attributes: name, path (relative to
  `draws/`), content, last-modified date, last-modified-by user,
  git SHA (for conflict detection).

- **DiagramFolder**: A subfolder under `draws/` in the repository.
  Used for organizational grouping. Attributes: name, path,
  list of child items (diagrams or subfolders).

- **SaveState**: The current persistence status of the active
  diagram. States: saved, unsaved, saving, error.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can browse all shared diagrams within 2 seconds
  of opening the sidebar.
- **SC-002**: Users can open any diagram from the repository in
  under 3 seconds.
- **SC-003**: Saving a diagram completes (commit created) within
  5 seconds under normal conditions.
- **SC-004**: 100% of saves produce a traceable commit in the
  repository with the correct author attribution.
- **SC-005**: Users never lose work — unsaved changes persist
  locally even when save operations fail.
- **SC-006**: Concurrent edit conflicts are detected and surfaced
  to the user 100% of the time (no silent overwrites).
- **SC-007**: The file browser reflects the actual repository state
  and updates within 5 seconds after changes.

## Assumptions

- The GitHub repository `inspark-me/docs` exists and is accessible
  with the configured access token.
- The `draws/` folder exists or will be created on first save.
- All team members are authenticated via Authentik before accessing
  InsparkDraw (guaranteed by Nginx Forward Auth).
- The team size is small enough (<50 users) that GitHub API rate
  limits (5000 req/hour) are not a concern.
- Excalidraw file format (`.excalidraw` JSON) is stable and does
  not require migration between versions.
- The existing sidebar component in InsparkDraw can be extended
  to host the file browser.
