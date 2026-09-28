# FieldOps — Local Development Onboarding Guide

---

## 1. Prerequisites

Before setting up FieldOps locally, ensure your workstation has:
- **Node.js**: `v20.x` or `v22.x` (LTS recommended).
- **pnpm**: `v10.x` or `v12.x` (`npm install -g pnpm`).
- **Flutter SDK**: `v3.24+` with Dart `3.5+` (configured in `$PATH`).
- **Docker & Docker Compose**: For local PostgreSQL / Supabase emulation.
- **Git**: `v2.25+`.

---

## 2. Step-by-Step Setup Workflow

### Step 1: Clone and Configure Environment
```bash
git clone https://github.com/fieldops/fieldops.git
cd fieldops

# Copy the canonical environment template
cp .env.example .env.local
```

### Step 2: Install Workspace Dependencies
```bash
pnpm install
```

### Step 3: Build Shared Packages
```bash
pnpm build
```

### Step 4: Run Verification Checks
```bash
# Verify TypeScript across all packages and web app
pnpm typecheck

# Run the test suite
pnpm test

# Run Flutter mobile analysis and tests
cd apps/mobile
flutter pub get
flutter analyze
flutter test
cd ../..
```

---

## 3. Running Applications Locally

### Web Management Console
```bash
pnpm --filter @fieldops/web dev
# Accessible at http://localhost:3000
```

### Mobile Field Client
```bash
cd apps/mobile
flutter run -d chrome # or target an Android / iOS simulator
```

---

## 4. Standard Development Commands Reference

| Command | Action |
| :--- | :--- |
| `pnpm dev` | Starts development servers in parallel across workspace. |
| `pnpm build` | Executes cached production builds via Turborepo. |
| `pnpm typecheck`| Runs TypeScript compiler (`tsc --noEmit`) across all packages. |
| `pnpm test` | Runs the Vitest test suite across all packages and web. |
| `pnpm format` | Formats all code according to Prettier standards. |
| `pnpm clean` | Purges build artifacts (`.next`, `dist`, `.turbo`, `build`). |
