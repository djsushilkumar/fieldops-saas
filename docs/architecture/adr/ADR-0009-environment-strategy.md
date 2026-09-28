# ADR-0009: Environment Separation & Configuration Strategy

- **Status**: Accepted
- **Date**: 2026-09-28
- **Author**: Lead DevOps & Security Architect

---

## 1. Context

Operational SaaS platforms manage customer production databases alongside development and staging environments. Accidental connection of a local development instance to a production database, or committing production API keys into client-side bundles, can cause catastrophic data corruption or breach.

---

## 2. Problem

How should runtime environments and configuration secrets be isolated, validated, and managed across the development lifecycle?

---

## 3. Options Considered

1. **Ad-Hoc `.env` Files without Runtime Validation**:
   - *Pros*: Minimal setup.
   - *Cons*: Missing environment variables cause runtime crashes hours after deployment; high risk of committing `.env` with live secrets; no protection against leaking server secrets into client code.
2. **Strict Environment Tiering with Validated Configuration Schemas**:
   - *Pros*: Canonical separation between `development`, `staging`, `production`, and `test`; Zod validation schemas (`@fieldops/config`) guarantee fail-fast startup; runtime checks prevent server secrets from loading in browser contexts.

---

## 4. Decision

We will implement **Strict Environment Tiering with Validated Configuration Schemas**:
- Four isolated environments: `development` (local Docker), `test` (ephemeral CI), `staging` (pre-release validation), `production` (live SaaS).
- `.env.example` serves as the sole checked-in template; `.env` is strictly ignored by Git.
- Client variables must be prefixed with `NEXT_PUBLIC_*`.
- `@fieldops/config` validates all variables on boot and throws an immediate security exception if `loadServerConfig()` is called in a browser context.
- Automated security tests scan the codebase on every pull request to ensure zero secret patterns exist in client packages.

---

## 5. Consequences

- **Positive**: Zero risk of accidental production targeting during local development; fail-fast configuration errors before serving traffic; verified secret leakage prevention.
- **Negative**: Developers must maintain environment variables in their local `.env.local` files.
