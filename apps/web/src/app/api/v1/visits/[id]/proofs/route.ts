import { NextRequest, NextResponse } from 'next/server';
import { memoryDb, ensureTenantSeeded } from '@/lib/server-store';
import { TenantId, VisitProof, UUID, IsoDateTime, VisitId, ProofType } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = (request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
  ensureTenantSeeded(tenantId);

  const orgVisits = memoryDb.visits.get(tenantId) || [];
  const visit = orgVisits.find((v) => v.id === params.id);

  if (!visit) {
    return NextResponse.json({ success: true, data: [] });
  }

  const proofs = (visit.proofs || []).map((p: any, idx: number) => ({
    id: `prf_${params.id}_${idx + 1}` as UUID,
    visitId: params.id as VisitId,
    organizationId: tenantId,
    proofType: (p.type || p.proofType || ProofType.PHOTO) as ProofType,
    storagePath: p.storagePath || 'media/visits/sample.jpg',
    fileName: p.fileName || p.storagePath?.split('/').pop() || 'photo.jpg',
    mimeType: p.mimeType || 'image/jpeg',
    fileSizeBytes: p.fileSizeBytes || 102400,
    signerName: p.signerName,
    notes: p.notes,
    createdAt: new Date().toISOString() as IsoDateTime,
  }));

  return NextResponse.json({ success: true, data: proofs });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = (request.headers.get('x-tenant-id') ||
      request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
    ensureTenantSeeded(tenantId);

    const body = await request.json();
    const orgVisits = memoryDb.visits.get(tenantId) || [];
    const index = orgVisits.findIndex((v) => v.id === params.id);

    if (index === -1) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Visit not found' } },
        { status: 404 }
      );
    }

    const visit = orgVisits[index];
    const newProof: VisitProof = {
      id: `prf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` as UUID,
      visitId: params.id as VisitId,
      organizationId: tenantId,
      proofType: body.proofType || ProofType.PHOTO,
      storagePath: body.storagePath || 'media/visits/proof.jpg',
      fileName: body.fileName || 'proof.jpg',
      mimeType: body.mimeType || 'image/jpeg',
      fileSizeBytes: body.fileSizeBytes || 204800,
      signerName: body.signerName,
      notes: body.notes,
      createdBy: 'usr_owner' as any,
      createdAt: new Date().toISOString() as IsoDateTime,
    };

    const proofs = [...(visit.proofs || []), newProof];
    orgVisits[index] = {
      ...visit,
      proofs,
      version: visit.version + 1,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };
    memoryDb.visits.set(tenantId, orgVisits);

    return NextResponse.json({ success: true, data: newProof });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
