# ADR-0002: Monorepo Architecture & Tooling Strategy

- **Status**: Accepted
- **Date**: 2026-09-28
- **Author**: Lead Software Architect

---

## 1. Context

FieldOps encompasses a web management dashboard, an iOS/Android mobile client, backend database contracts, and shared TypeScript libraries (types, validation schemas, design tokens, configuration loaders, API client). Maintaining multiple decoupled repositories would lead to dependency drift, out-of-sync type contracts, and complex cross-repo pull requests.

---

## 2. Problem

How should the codebase be structured and managed to maximize developer velocity, guarantee atomic type updates, and optimize CI build times?

---

## 3. Options Considered

1. **Polyrepo (Separate Repositories)**:
   - *Pros*: Independent repository permissions and version tags.
   - *Cons*: High friction when changing shared API schemas or design tokens; requires publishing private npm packages; difficult to coordinate cross-platform releases.
2. **Yarn / Lerna Monorepo**:
   - *Pros*: Mature ecosystem.
   - *Cons*: Slower installation speeds; complex hoisting issues and phantom dependencies.
3. **pnpm Workspaces + Turborepo**:
   - *Pros*: Content-addressable hard-linked storage saves disk space; strict isolated dependency trees prevent phantom dependencies; Turborepo provides blazing-fast remote caching and topological build pipelines.

---

## 4. Decision

We will implement a **unified monorepo using pnpm Workspaces and Turborepo**:
- Applications reside in `apps/` (`web`, `mobile`).
- Shared packages reside in `packages/` (`types`, `validation`, `config`, `design-tokens`, `api`, `tooling`).
- Database and infrastructure configurations reside in `supabase/`.
- CI pipelines execute via `turbo run typecheck test build` leveraging cached task hashes.

---

## 5. Consequences

- **Positive**: Single pull request can atomically update backend schemas, shared validation types, web views, and mobile token classes; instant local feedback; fast CI execution.
- **Negative**: Requires maintaining monorepo tooling and ensuring Flutter tooling coexists cleanly with Node workspace pipelines.
