# FieldOps — Development Environment Guidelines

---

## 1. Development Principles

The development environment is optimized for rapid feedback, strict type safety, and reproducible builds.

1. **Isolation**: Development databases run locally on Docker/Supabase emulation. Never target staging or production databases from development workstations.
2. **Synthetic Data**: Use deterministic seed data from `supabase/seed/seed.sql`. Never import sanitized production backups into development environments.
3. **Atomic Changes**: Keep pull requests focused on a single architectural boundary or feature package.
