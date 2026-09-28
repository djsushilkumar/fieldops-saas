# FieldOps — File Storage Architecture & Media Pipeline

---

## 1. Storage Strategy

FieldOps relies on S3-compatible cloud object storage (e.g. Supabase Storage / AWS S3) for storing proof-of-work photos, vector signatures, and operational attachments.

---

## 2. Storage Bucket Architecture & Tenant Isolation

To enforce multi-tenant isolation, direct public access to storage buckets is **strictly prohibited**. All object keys are partitioned by `organization_id`:

```
s3://fieldops-media/
  └── {organization_id}/
        ├── proofs/
        │     └── {year}/{month}/{task_or_visit_id}/{file_uuid}.jpg
        ├── signatures/
        │     └── {year}/{month}/{visit_id}/sig_{uuid}.svg
        └── attachments/
              └── {task_id}/{file_uuid}.pdf
```

---

## 3. Pre-Signed URL Access Protocol

1. **Upload Workflow**:
   - Client requests an upload token: `POST /api/v1/storage/upload-url` with `file_name`, `content_type`, and `task_id`.
   - Server validates tenant context and user role.
   - Server returns a short-lived (5-minute TTL) pre-signed PUT URL with strict content-length and content-type headers.
   - Client uploads the binary payload directly to object storage via HTTP PUT.
2. **Download / View Workflow**:
   - Client requests resource: `GET /api/v1/tasks/:id/proofs`.
   - Server generates temporary (15-minute TTL) pre-signed GET URLs for authorized team members.

---

## 4. File Validation & Security Rules

| Attribute | Constraint / Rule |
| :--- | :--- |
| **Permitted MIME Types** | `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `image/svg+xml` |
| **Max Photo Size** | $15\text{MB}$ per photo (compressed locally on device to $\le 1.5\text{MB}$ prior to upload) |
| **Max Document Size** | $10\text{MB}$ per PDF document |
| **Malware Scanning** | Asynchronous cloud function triggers ClamAV scan upon bucket event. Quarantines suspicious binaries. |
| **Data Retention** | Proof photos retained for the duration of the tenant subscription + 90 days post-cancellation. |
