# FieldOps — Account Security & Final Owner Protection

---

## 1. Password Complexity & Policy Baseline

FieldOps enforces standard production SaaS password policies:
- Minimum length: 8 characters
- Must include at least 1 lowercase letter (`[a-z]`)
- Must include at least 1 uppercase letter (`[A-Z]`)
- Must include at least 1 digit (`[0-9]`)
- Must include at least 1 special character (`[^a-zA-Z0-9]`)
- Hashing: Executed via bcrypt / argon2 inside Supabase Auth GoTrue.

---

## 2. Final Owner Protection Invariant

A catastrophic failure mode in SaaS multi-tenancy occurs when an organization's sole Owner account is accidentally deleted, removed, or demoted to Admin. The tenant becomes orphaned and permanently unmanageable.

FieldOps eliminates this failure mode at the database engine level via PostgreSQL trigger:

```sql
CREATE TRIGGER trg_prevent_last_owner_removal
  BEFORE UPDATE OR DELETE ON memberships
  FOR EACH ROW EXECUTE FUNCTION prevent_last_owner_removal();
```

### Invariant Rules:
1. When an organization has exactly 1 `ACTIVE` `OWNER`:
   - Any `DELETE` on that membership raises an uncatchable exception:
     `Cannot remove, suspend, or demote the last remaining ACTIVE OWNER of an organization`.
   - Any `UPDATE` modifying `role` to anything other than `OWNER` raises an exception.
   - Any `UPDATE` modifying `status` to `SUSPENDED` or `REMOVED` raises an exception.
2. In multi-owner organizations, an Owner may be demoted or removed as long as at least 1 other `ACTIVE` `OWNER` exists.
