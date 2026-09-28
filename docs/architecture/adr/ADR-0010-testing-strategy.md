# ADR-0010: Testing Architecture & Quality Gates

- **Status**: Accepted
- **Date**: 2026-09-28
- **Author**: Lead QA & System Architect

---

## 1. Context

FieldOps manages physical work, employee timecards, and multi-tenant operational data. Software regressions can result in workers dispatched to incorrect destinations, lost proof of work, or cross-tenant privacy violations.

---

## 2. Problem

What testing strategy and automated verification pipeline ensures software reliability across web, mobile, multi-tenant databases, and offline environments?

---

## 3. Options Considered

1. **Unit Tests Only**:
   - *Pros*: Fast execution.
   - *Cons*: Fails to verify PostgreSQL Row-Level Security policies, offline sync race conditions, or mobile hardware lifecycle events.
2. **Heavy End-to-End Tests Only**:
   - *Pros*: Tests full user journeys.
   - *Cons*: Slow, flaky, expensive to maintain, and difficult to pinpoint exact failure causes.
3. **Layered Test Pyramid with Specialized Verification Gates**:
   - Fast unit tests for pure domain logic (Haversine math, state machines).
   - Integration tests with real PostgreSQL instances for RLS policies.
   - Automated cross-tenant security test harness.
   - Offline simulation tests (network cutting, idempotency replay).
   - Mobile widget and unit tests via `flutter test`.

---

## 4. Decision

We will implement a **Layered Test Pyramid with Strict CI Quality Gates**:
- **Unit & Smoke Tests**: Vitest for TypeScript packages and Web; `flutter test` for Mobile.
- **Cross-Tenant Security Suite**: Dedicated matrix test verifying 100% rejection when Tenant A queries Tenant B resources.
- **Offline Simulation Tests**: Verifying local SQLite persistence and deduplicated background sync under simulated disconnections.
- **CI Enforcement**: Every pull request must pass linting, typechecking, security scans, and test suites with zero warnings.
- **Governance**: Binding rules in `AGENTS.md` prohibit deleting tests or weakening security checks to make CI pass.

---

## 5. Consequences

- **Positive**: Comprehensive defect prevention; high confidence in multi-tenant isolation; automated regression detection.
- **Negative**: Requires maintaining test fixtures and mock harnesses across TypeScript and Dart.
