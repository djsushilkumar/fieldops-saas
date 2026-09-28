# FieldOps — CI Testing Policies & Automated Quality Gates

---

## 1. Automated Gate Enforcement

Every pull request triggers GitHub Actions executing three parallel validation jobs:

1. **`validate-web-and-packages`**:
   - `pnpm install --frozen-lockfile`
   - `pnpm typecheck`
   - `pnpm test` (All Vitest suites)
   - `pnpm build` (Package builds)
2. **`validate-mobile`**:
   - `flutter pub get`
   - `flutter analyze --fatal-infos`
   - `flutter test` (Unit and widget tests)
3. **`security-scan`**:
   - Executes `tests/security/secret-exposure.test.ts` scanning for credentials, unencrypted keys, or `.env` files.

Failure in any job blocks merging to the `main` branch.
