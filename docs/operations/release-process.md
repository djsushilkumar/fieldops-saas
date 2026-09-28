# Production Release Engineering & Deployment Process — FieldOps SaaS

| Document Version | 1.0.0 |
| :--- | :--- |
| **Phase** | **Phase 10 — Production Launch & Operations** |
| **Release Frequency** | Bi-weekly planned releases; emergency hotfixes as needed |
| **Branching Model** | GitHub Flow (`master` protected; feature branches via Pull Requests) |

---

## 1. End-to-End Release Pipeline

```
[Feature Branch]
       │
       ▼
[Pull Request (PR)] ──────► [Automated CI: Lint, Turbo Typecheck, Vitest, Flutter Test]
       │ (2 Approvals)
       ▼
[Merge to master] ────────► [Automated Staging Deployment & Smoke Verification]
       │
       ▼
[Release Candidate Tag] ──► [v1.0.0-rc.X created; Regression & QA Matrix Verified]
       │ (VP Eng Sign-off)
       ▼
[Production Deployment] ──► [Blue/Green Canary Rollout; Zero-Downtime Migration]
       │
       ▼
[Post-Deployment Smoke] ──► [scripts/production-smoke-test.ts (11/11 PASS)]
       │
       ▼
[Monitoring Window] ──────► [4-hour observation period for error spikes & latency]
```

---

## 2. Pre-Release Gate Checklist

Before creating a production Release Candidate (RC):
1. **Zero Open P0/P1 Defects**: All critical bugs resolved.
2. **CI Pipeline 100% Green**:
   - `pnpm turbo run typecheck` passes with zero errors (11 packages/apps).
   - `pnpm vitest run` passes all 54 test files (380 tests).
   - `flutter test` passes all 43 mobile test suites.
   - Security scan confirms zero exposed credentials or RLS bypasses.
3. **Database Migration Safety Check**:
   - Sequential timestamp naming verified in `supabase/migrations/`.
   - Backward-compatible schema evolution: Expand $\to$ Deploy application $\to$ Contract.
   - Non-locking index creation (`CREATE INDEX CONCURRENTLY` in production).

---

## 3. Web Deployment Strategy (`apps/web`)

1. **Immutable Artifacts**: Next.js applications are compiled into standalone container images tagged with the commit SHA and semantic version (`v1.0.0`).
2. **Blue/Green Deployment**:
   - New container deployment boots in parallel alongside active version.
   - Health probes (`/api/health/live` and `/api/health/ready`) must return HTTP 200 before routing traffic.
   - Ingress router switches traffic instantaneously; zero connection drops.
3. **Rollback Ready**: Previous deployment container remains warm for 60 minutes for instant one-click rollback if error rates exceed 0.5%.

---

## 4. Mobile Release Strategy (`apps/mobile`)

1. **Staged Rollout Cadence**:
   - **Day 1**: 5% of active Android / iOS users.
   - **Day 2**: 15% (Monitor crash-free sessions $> 99.8\%$).
   - **Day 3**: 50% (Monitor sync failures $< 0.1\%$).
   - **Day 5**: 100% full release.
2. **Halting Rollout**:
   - If Sentry detects crash rate $> 0.5\%$ or critical sync failure, release rollout is immediately paused in Google Play Console / App Store Connect.
3. **Backward Compatibility**:
   - Backend APIs support mobile clients back to version $V_{current - 2}$.
   - Old mobile clients must not fail or crash upon receiving new optional backend fields.

---

## 5. Post-Deployment Verification & Handover

Immediately following production deployment:
1. Run automated production smoke suite:
   ```bash
   npx tsx scripts/production-smoke-test.ts
   ```
2. Verify Sentry error rates remain below $0.1\%$.
3. Post deployment announcement to `#fieldops-releases` with release notes and commit SHA.
