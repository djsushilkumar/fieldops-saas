# Production Access Control & Privileged Operations Policy — FieldOps SaaS

| Document Version | 1.0.0 |
| :--- | :--- |
| **Phase** | **Phase 10 — Production Launch & Operations** |
| **Enforcement** | **Mandatory Multi-Factor Authentication (MFA) on 100% of privileged systems** |
| **Principle** | **Least Privilege, Zero Shared Accounts, Immutable Audit Logging** |

---

## 1. Privileged Access Matrix

Shared generic accounts (`admin@`, `root@`, `deploy@`) are **strictly prohibited**. Every privileged engineer operates via named, audited identity credentials.

| Platform / Subsystem | Authorized Roles | Access Scope | Authentication Standard | Session Policy |
| :--- | :--- | :--- | :--- | :--- |
| **AWS Management Console** | Lead SRE, VP Engineering | Cloud infrastructure, KMS, Secrets Manager | SSO / FIDO2 Hardware Key (YubiKey) | Max 4-hour session; re-auth required |
| **Supabase / PostgreSQL Prod** | Lead DBA, Lead SRE | Connection pool management, migrations, PITR | Bastion VPN + Individual DB user | Read-only by default; elevated via ticket |
| **GitHub Enterprise** | Core Maintainers | Repository settings, branch protection, secrets | WebAuthn MFA + SSH Signing Keys | Protected branch rules require 2 reviews |
| **Stripe Dashboard** | Finance Lead, Tech Lead | Subscription overview, refunds, webhook inspection | Hardware MFA + Restricted Team Role | No raw card viewing permissions |
| **Google Play / App Store** | Mobile Lead, Release Mgr | App submission, release phased rollout, certs | Apple Developer / Google Workspace MFA | Restricted to App Manager / Release role |
| **Datadog / Sentry** | All Engineering Staff | APM traces, error logs, synthetic monitors | Google Workspace SSO + MFA | Read-only application telemetry |

---

## 2. Mandatory MFA Enforcement

Hardware security keys (FIDO2 / WebAuthn) or time-based one-time passwords (TOTP via 1Password / Google Authenticator) are strictly enforced across:
1. GitHub Organization (any account without MFA is automatically detached).
2. AWS Root & IAM Identity Center.
3. Supabase Organization Console.
4. Stripe Production Account.
5. Apple Developer & Google Play Developer accounts.
6. Cloudflare Edge DNS.

---

## 3. Emergency Break-Glass & Customer Impersonation Protocol

If an urgent production emergency requires direct database intervention:

1. **Break-Glass Credential Custody**:
   - The master break-glass credentials for PostgreSQL RDS and AWS root are stored in a split-key digital vault (Shamir's Secret Sharing: requires 2 of 3 designated keyholders: VP Eng, CTO, Lead Architect).
2. **Access Justification**:
   - Every break-glass activation triggers an automated alert to `#security-audit` with the engineer's identity and incident ticket number.
3. **Session Recording & Immediate Revocation**:
   - Bastion SSH sessions are keystroke-recorded.
   - Upon incident resolution, the break-glass password is rotated immediately per [Production Secret Management](file:///workspace/clever-darwin/docs/operations/production-secrets.md).

---

## 4. Account Recovery & Succession Planning

To prevent single-person points of failure:
- **Primary Owner Account**: Backed by a corporate hardware key stored in a dual-custody physical safe at corporate headquarters.
- **Secondary Administrator**: At least two senior engineering directors maintain full administrator recovery privileges across AWS, GitHub, Supabase, and Stripe.
- **Quarterly Access Review**: Every 90 days, the Security Officer audits all privileged access grants, revoking permissions for transitioned or departed personnel.
