<!--
Sync Impact Report
==================
Version Change: N/A → 2.0.0 (initial adoption)
Modified Principles: Adapted generic template for InsparkDraw project
Added Sections: All (initial)
Removed Sections: RLS (no relational DB), Compliance (internal tool)

Templates Requiring Updates:
- plan-template.md ✅ No changes needed (generic)
- spec-template.md ✅ No changes needed (generic)
- tasks-template.md ✅ No changes needed (generic)
- checklist-template.md ✅ No changes needed (generic)

Follow-up TODOs: None
-->

# InsparkDraw Constitution

> **Authority**: This constitution supersedes all other development practices.
> Runtime guidance in `CLAUDE.md` implements these principles operationally.

## Core Principles

### I. Context-First Development (NON-NEGOTIABLE)

Before any implementation or delegation, gather comprehensive context:
- Read existing code in related files
- Search for similar patterns and implementations
- Review specs, ADRs, and recent commits
- Understand dependencies and integration points

**Rationale**: Prevents duplicate work, ensures consistency, avoids
conflicting approaches.

### II. Single Source of Truth

Types, constants, enums, schemas, and shared logic MUST be defined in
designated central locations (e.g., `packages/excalidraw/types.ts` for
core types, `excalidraw-app/auth/types.ts` for auth types,
`excalidraw-app/app_constants.ts` for app constants).
Duplication is forbidden — consumers must import from the source.

**Rationale**: Eliminates drift between duplicate definitions, simplifies
refactoring.

### III. Library-First Development

Before implementing custom solutions (>20 lines):
1. Search for existing libraries (npm)
2. Evaluate: maintenance status, security, bundle size, TypeScript support
3. Use library if it covers >70% of requirements

**Context7 Rule**: Before writing code that uses ANY library, MUST fetch
up-to-date documentation via `mcp__context7__get-library-docs`. This
ensures correct API usage and avoids deprecated patterns.

**Rationale**: Reduces maintenance burden, leverages community standards
and security fixes.

### IV. Code Reuse & DRY

Before creating new components, utilities, or logic:
1. Search existing codebase for reusable implementations
2. Prefer adapting and extending over duplicating
3. Document why reuse was not possible if creating new

**Rationale**: Reduces codebase size, ensures consistent behavior, lowers
cognitive load.

### V. Strict Type Safety (NON-NEGOTIABLE)

- TypeScript `strict` mode enforced
- `any` is prohibited — use `unknown` or proper types
- Explicit return types for exported functions
- Type-check must pass before commit

**Rationale**: Catches errors at compile time, enables safe refactoring,
improves IDE support.

### VI. Atomic Task Execution

Each task must be independently completable, testable, and committable:
- Mark task `in_progress` before starting
- Verify implementation (read files + run checks)
- Mark `completed` after validation only
- Commit after EACH task, not in batches

**Atomic Delegation Rule**: One agent invocation = one task. Never batch
multiple tasks into a single agent call.
- Parallel work: Launch N agents in single message, each with one task
- Sequential work: Complete one agent call, then start next

**Rationale**: Enables easy rollback, clear progress tracking, better
code review.

### VII. Quality Gates (NON-NEGOTIABLE)

Before any commit:
- [ ] Type-check passes (`npx tsc --noEmit`)
- [ ] Build succeeds (`yarn build:app:docker`)
- [ ] No hardcoded credentials
- [ ] No `TODO` without issue reference

**Rationale**: Prevents broken code in main branch, maintains codebase
health.

### VIII. Progressive Specification

Features progress through mandatory phases:
1. **Spec** → User stories and requirements
2. **Plan** → Technical approach and decisions
3. **Tasks** → Atomic, ordered implementation steps
4. **Implement** → Execute with validation

No phase can be skipped. Each output validated before proceeding.

**Rationale**: Reduces rework, validates approach before expensive
implementation.

## Operational Excellence

### IX. Self-Hosted First (NON-NEGOTIABLE)

- No external SaaS dependencies for core functionality
- All services run within Inspark infrastructure
- Data stays on-premises (GitHub org repo, Authentik SSO)
- Third-party APIs (OpenAI, Claude) only for optional AI features

**Rationale**: Full control over data, no vendor lock-in, works offline
from external services.

### X. Error Handling

- All errors must be typed (custom Error classes or union types)
- User-facing errors: localized, actionable, no stack traces
- Internal errors: structured logging with context
- Never swallow errors silently

### XI. Accessibility (RECOMMENDED)

- Keyboard navigation support
- Screen reader compatibility where practical
- Color contrast requirements met
- Visual changes verified in Light and Dark themes

## Security Requirements

### Data Protection

- No hardcoded credentials — use environment variables
- Authentik SSO (Forward Auth) for authentication
- GitHub PAT for repository access — server-side only, never exposed
  to client
- Input validation on all API endpoints

### Trust Model

- Authentik headers trusted only behind Nginx Proxy Manager
- Docker containers not exposed directly to the internet
- Server validates presence of auth headers, does not authenticate
  itself

## Technology Standards

### Core Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript (strict), JavaScript (server) |
| Frontend | React 18, Vite, Jotai, Radix UI |
| Backend | Node.js, Express |
| Storage | GitHub API (Octokit) — `inspark-me/docs` repo |
| Auth | Authentik SSO (Forward Auth via Nginx) |
| Hosting | Docker → Nginx Proxy Manager (self-hosted) |

### File Organization

```
excalidraw-app/
  auth/              # Auth types, atoms, hooks
  collab/            # Collaboration (WebSocket)
  components/        # App-level UI components
  data/              # Data layer (localStorage, Firebase, GitHub)
  server/            # Dev middleware, future API modules
  server.js          # Production Express server
packages/
  excalidraw/        # Core editor (upstream fork)
  element/           # Element types and logic
  common/            # Shared utilities
  math/              # Math utilities
  utils/             # Public utilities
.specify/
  specs/             # Feature specifications
  templates/         # Spec templates
  memory/            # Constitution, context
```

## Governance

### Amendment Procedure

Constitution changes require:
1. Documented rationale
2. Impact analysis on templates/workflows
3. Version bump (MAJOR: breaking, MINOR: additive, PATCH: clarification)
4. Sync Impact Report in header
5. Update dependent documentation

### Exception Process

Principle violations require justification in plan.md:
- Why violation is necessary
- Alternatives considered and rejected
- Mitigation strategies

### Document Hierarchy

1. **Constitution** (this file) — Principles and laws
2. **CLAUDE.md** — Operational procedures implementing principles
3. **Spec/Plan/Tasks** — Feature-specific guidance

---

**Version**: 2.0.0 | **Ratified**: 2026-02-26 | **Last Amended**: 2026-02-26
