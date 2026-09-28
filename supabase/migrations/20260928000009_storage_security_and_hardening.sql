-- FieldOps Phase 09: Security, QA & Production Hardening
-- Migration: 20260928000009_storage_security_and_hardening.sql

-- =============================================================================
-- 1. STORAGE BUCKET CREATION (PRIVATE, STRICT MIME & SIZE RESTRICTIONS)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'fieldops-media',
    'fieldops-media',
    false, -- Strictly private; pre-signed URLs required
    15728640, -- 15MB limit
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'image/svg+xml'
    ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 15728640,
    allowed_mime_types = ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'image/svg+xml'
    ]::text[];

-- =============================================================================
-- 2. STORAGE ROW-LEVEL SECURITY POLICIES (MULTI-TENANT PATH ISOLATION)
-- Object path convention: {organization_id}/{category}/{entity_id}/{file_id}.ext
-- =============================================================================

-- Ensure RLS is active on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2.1 SELECT (Read) Policy: Users can only read objects in their active tenant path
DROP POLICY IF EXISTS "storage_tenant_read_isolation" ON storage.objects;
CREATE POLICY "storage_tenant_read_isolation"
    ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'fieldops-media'
        AND (storage.foldername(name))[1] = public.current_tenant_id()::text
        AND EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.organization_id = public.current_tenant_id()
              AND m.user_id = auth.uid()
              AND m.status = 'ACTIVE'
        )
    );

-- 2.2 INSERT (Upload) Policy: Users can only upload objects into their active tenant path
DROP POLICY IF EXISTS "storage_tenant_upload_isolation" ON storage.objects;
CREATE POLICY "storage_tenant_upload_isolation"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'fieldops-media'
        AND (storage.foldername(name))[1] = public.current_tenant_id()::text
        AND EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.organization_id = public.current_tenant_id()
              AND m.user_id = auth.uid()
              AND m.status = 'ACTIVE'
        )
    );

-- 2.3 DELETE Policy: Only Owner or Admin can delete operational media objects
DROP POLICY IF EXISTS "storage_tenant_delete_restricted" ON storage.objects;
CREATE POLICY "storage_tenant_delete_restricted"
    ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'fieldops-media'
        AND (storage.foldername(name))[1] = public.current_tenant_id()::text
        AND EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.organization_id = public.current_tenant_id()
              AND m.user_id = auth.uid()
              AND m.role IN ('OWNER', 'ADMIN')
              AND m.status = 'ACTIVE'
        )
    );
