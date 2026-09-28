# FieldOps — Test Environments & Data Fixtures

---

## 1. Test Environment Strategies

1. **Local Test Environment**:
   - In-memory mock transports for API client tests.
   - Synthetic seed data loaded into local Docker/Supabase instances.
2. **CI Pipeline Environment**:
   - Ephemeral runners on GitHub Actions executing headless Vitest and Flutter tests.
   - Frozen dependency lockfile enforcement.
3. **Staging Verification**:
   - Automated end-to-end smoke testing against isolated staging tenant accounts.
