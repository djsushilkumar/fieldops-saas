# FieldOps — Web Authentication Implementation Guide

---

## 1. Next.js 14 App Router Architecture

The Web application under `apps/web` organizes authentication and tenant routing into two isolated route groups:

```
apps/web/src/app/
├── (auth)/                  # Public Authentication Route Group
│   ├── login/               # Sign In Screen (Email + Password)
│   ├── signup/              # Registration & Organization Creation
│   ├── forgot-password/     # Password Recovery Request
│   └── reset-password/      # New Password Setup
└── (app)/                   # Protected Application Route Group
    ├── org/
    │   ├── select/          # Organization Switcher & Directory
    │   └── create/          # New Tenant Bootstrap
    ├── dashboard/           # Active Tenant Command Console
    ├── account/
    │   └── profile/         # User Identity Management
    └── organization/
        └── members/         # Personnel, Roles & Invitations
```

---

## 2. Route Protection & Edge Middleware

The edge middleware (`apps/web/src/middleware.ts`) operates as the first line of defense:

1. **Unauthenticated Redirection**: Any request targeting protected routes (`/dashboard`, `/account/*`, `/organization/*`) without a valid `fieldops_access_token` cookie is immediately redirected to `/login?redirect=<path>`.
2. **Authenticated Bounce**: An authenticated user visiting public pages (`/login`, `/signup`) is redirected to `/dashboard` (or `/org/select` if no organization is selected).
3. **Tenant Context Enforcement**: Requests reaching `/dashboard` without an active `fieldops_active_org_id` cookie are routed to `/org/select`.

---

## 3. Query Cache Isolation on Organization Switch

To prevent cross-tenant data bleeding across browser memory:
1. All organization-scoped queries use the key pattern:
   `['organization', activeOrgId, ...subKeys]`
2. When `switchOrganization(newOrgId)` is executed in `OrganizationContext`:
   - `queryClient.removeQueries({ predicate: (q) => q.queryKey[0] === 'organization' })` is executed.
   - All tenant queries are flushed immediately before loading data for the new organization.
