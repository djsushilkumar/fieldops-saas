import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { VisitProof, UUID, IsoDateTime, VisitId, ProofType } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await adminClient
        .from('visit_proofs')
        .select('*')
        .eq('visit_id', params.id)
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      const proofs: VisitProof[] = (data || []).map((p: any) => ({
        id: p.id as UUID,
        visitId: p.visit_id as VisitId,
        organizationId: p.organization_id,
        proofType: p.proof_type as ProofType,
        storagePath: p.storage_path,
        fileName: p.file_name || 'proof.jpg',
        mimeType: p.mime_type || 'image/jpeg',
        fileSizeBytes: Number(p.file_size_bytes || 0),
        signerName: p.signer_name || undefined,
        notes: p.notes || undefined,
        createdBy: (p.created_by || user.id) as any,
        createdAt: p.created_at as IsoDateTime,
      }));

      return NextResponse.json({ success: true, data: proofs });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, data: [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  try {
    const body = await request.json();
    const proofType = body?.proofType || ProofType.PHOTO;
    const storagePath = body?.storagePath?.trim();

    if (!storagePath) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'storagePath is required' } },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      // Verify visit exists in tenant
      const { data: visit, error: visitErr } = await adminClient
        .from('visits')
        .select('id')
        .eq('id', params.id)
        .eq('organization_id', tenantId)
        .maybeSingle();

      if (visitErr || !visit) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Visit not found' } },
          { status: 404 }
        );
      }

      const { data: inserted, error: insertErr } = await adminClient
        .from('visit_proofs')
        .insert({
          visit_id: params.id,
          organization_id: tenantId,
          proof_type: proofType,
          storage_path: storagePath,
          file_name: body.fileName || 'proof.jpg',
          mime_type: body.mimeType || 'image/jpeg',
          file_size_bytes: body.fileSizeBytes || 0,
          watermark: body.watermark || null,
          signer_name: body.signerName || null,
          notes: body.notes || null,
          created_by: user.id, // Strictly server-derived from authenticated user
        })
        .select()
        .single();

      if (insertErr || !inserted) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: insertErr?.message } },
          { status: 500 }
        );
      }

      await adminClient.from('visit_activities').insert({
        visit_id: params.id,
        organization_id: tenantId,
        actor_id: user.id,
        action: 'PROOF_UPLOADED',
        details: { proofType, storagePath },
      });

      const responseProof: VisitProof = {
        id: inserted.id as UUID,
        visitId: inserted.visit_id as VisitId,
        organizationId: inserted.organization_id,
        proofType: inserted.proof_type as ProofType,
        storagePath: inserted.storage_path,
        fileName: inserted.file_name,
        mimeType: inserted.mime_type,
        fileSizeBytes: Number(inserted.file_size_bytes),
        signerName: inserted.signer_name || undefined,
        notes: inserted.notes || undefined,
        createdBy: user.id,
        createdAt: inserted.created_at as IsoDateTime,
      };

      return NextResponse.json({ success: true, data: responseProof });
    }

    const fallback: VisitProof = {
      id: `prf_${Date.now()}` as UUID,
      visitId: params.id as VisitId,
      organizationId: tenantId,
      proofType,
      storagePath,
      fileName: body.fileName || 'proof.jpg',
      mimeType: body.mimeType || 'image/jpeg',
      fileSizeBytes: body.fileSizeBytes || 0,
      createdBy: user.id,
      createdAt: new Date().toISOString() as IsoDateTime,
    };

    return NextResponse.json({ success: true, data: fallback });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
