# FieldOps — Staging Environment & Verification

---

## 1. Staging Purpose

The Staging environment (`staging`) mirrors production cloud architecture:
- Multi-tenant PostgreSQL instance with PostGIS and enabled RLS.
- Hosted Supabase Auth and S3-compatible storage.
- Continuous deployment triggered automatically upon merge to the `main` branch.

---

## 2. Staging Quality Gate Checklist

Before a release candidate is approved for production:
- [ ] Database migrations applied successfully via automated pipeline.
- [ ] Zero RLS policy regressions detected in staging smoke tests.
- [ ] End-to-end task dispatch and mobile sync cycle verified.
- [ ] Pre-signed media upload and download verified.
