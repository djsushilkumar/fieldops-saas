# FieldOps Terms of Service

**Effective Date: September 28, 2026**  
**Last Updated: September 28, 2026**

These Terms of Service ("Terms") govern access to and use of the FieldOps SaaS platform, web console, mobile applications, and APIs (the "Service") provided by FieldOps Inc. ("FieldOps", "we", "us"). By registering for an account or using the Service, your organization ("Customer") agrees to be bound by these Terms.

---

## 1. Multi-Tenant SaaS Subscriptions & Plans

### 1.1 Subscription Tiers & Entitlements
FieldOps offers subscription tiers (`FREE`, `STARTER`, `GROWTH`, `BUSINESS`) with distinct usage quotas for active field workers, monthly task dispatches, and storage capacity as detailed on our pricing console:
- **Usage Limits**: Quotas are tracked atomically in real-time. If an organization exceeds its plan limits, the creation of new resources is temporarily gated until an upgrade is executed or usage resets.
- **Non-Destructive Downgrades**: If a customer downgrades to a lower subscription tier, **no existing data is deleted or purged**. Access to existing historical tasks, visits, and reports remains available in read-only mode if current counts exceed the lower plan's ceiling.

### 1.2 Billing & Payment Processing
- Subscriptions are billed in advance on a monthly or annual recurring cycle via Stripe.
- Taxes and statutory duties are billed based on the customer's jurisdiction.
- All payment obligations are non-cancelable and fees paid are non-refundable except where required by law.

---

## 2. Customer Responsibilities & Acceptable Use

Customer agrees to use the Service in compliance with all applicable laws and regulations:
1. **Notice to Field Personnel**: Customer is solely responsible for providing required legal notices to its employees and contractors regarding the use of FieldOps mobile applications, including point-in-time GPS check-in verification and attendance tracking.
2. **Acceptable Use Restrictions**: Customer shall not:
   - Attempt to bypass PostgreSQL Row-Level Security, access data of other tenants, or reverse-engineer API boundaries.
   - Use the Service for unlawful surveillance or continuous tracking outside discrete work order check-ins.
   - Inject malicious code, SQL payloads, or exceed storage upload ceilings (15MB per file).
   - Resell, sublicense, or operate the Service as a managed service bureau without prior written consent.

---

## 3. Service Level Objective (SLA)

- **Target Availability**: FieldOps targets **99.9% uptime** for core web consoles, mobile sync endpoints, and API services during each calendar month, excluding scheduled maintenance announced 48 hours in advance.
- **Scheduled Maintenance Windows**: Maintenance is scheduled during low-traffic windows (Sundays 02:00–04:00 UTC).

---

## 4. Proprietary Rights & Customer Data Ownership

- **Customer Data**: Customer retains 100% ownership, title, and intellectual property rights in and to all data uploaded to the Service (tasks, checklists, photos, customer signatures, and attendance logs).
- **Service Ownership**: FieldOps retains all rights, title, and interest in and to the software, mobile applications, database architectures, trademarks, and documentation.

---

## 5. Limitation of Liability

- To the maximum extent permitted by applicable law, neither party shall be liable for indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business interruption.
- FieldOps' total aggregate liability arising out of or related to these Terms shall not exceed the total fees paid by Customer in the twelve (12) months preceding the event giving rise to liability.
- **Field Safety Disclaimer**: FieldOps is an operational dispatch and verification software tool. Customer remains solely responsible for the physical safety, working conditions, traffic safety, and regulatory compliance of its field personnel.

---

## 6. Term, Cancellation & Termination

- **Cancellation**: Customer may cancel its subscription at any time via the Customer Billing Portal. Cancellation takes effect at the end of the current billing cycle.
- **Data Export & Transition Period**: Following cancellation or termination, Customer has thirty (30) calendar days to export its data via RFC 4180 CSV export or API tools. Following this transition window, tenant records are permanently deleted per our retention policy.

---

## 7. Governing Law & Dispute Resolution

These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to conflict of law principles. Any dispute arising under these Terms shall be resolved via binding arbitration administered by JAMS in San Francisco, California.
