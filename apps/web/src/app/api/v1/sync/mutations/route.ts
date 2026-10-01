import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import {
  OfflineMutation,
  OfflineMutationResult,
  OfflineSyncResponse,
  ErrorCode,
} from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  try {
    const body = await request.json();
    const mutations = (body?.mutations || []) as OfflineMutation[];

    if (!Array.isArray(mutations)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'mutations array is required' } },
        { status: 400 }
      );
    }

    const results: OfflineMutationResult[] = [];

    for (const mutation of mutations) {
      const { mutationId, idempotencyKey, entityType, entityId, action, payload, clientTimestamp } = mutation;

      if (!idempotencyKey || !mutationId) {
        results.push({
          mutationId,
          idempotencyKey,
          status: 'REJECTED',
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'mutationId and idempotencyKey are required',
            request_id: 'sync_val',
          },
        });
        continue;
      }

      if (isSupabaseConfigured()) {
        try {
          // 1. Check idempotency: Deduplicate if key was already processed
          const { data: existing } = await adminClient
            .from('offline_mutations')
            .select('id, status')
            .eq('idempotency_key', idempotencyKey)
            .maybeSingle();

          if (existing) {
            results.push({
              mutationId,
              idempotencyKey,
              status: 'DEDUPLICATED',
            });
            continue;
          }

          // 2. Process mutation by entity and action
          let mutationStatus: 'APPLIED' | 'CONFLICT' | 'REJECTED' = 'APPLIED';
          let errorMessage: string | undefined;
          let errorCode = ErrorCode.INTERNAL_ERROR;

          if (entityType === 'task' && (action === 'transition_status' || action === 'transition')) {
            const taskPayload = payload as any;
            const { error: rpcErr } = await adminClient.rpc('transition_task_status', {
              p_task_id: entityId,
              p_target_status: taskPayload?.status,
              p_actor_id: user.id,
              p_blocked_reason: taskPayload?.blockedReason || null,
              p_reopen_reason: taskPayload?.reopenReason || null,
              p_expected_version: taskPayload?.version != null ? Number(taskPayload.version) : null,
            });

            if (rpcErr) {
              const msg = rpcErr.message || '';
              if (msg.includes('TASK_CONFLICT')) {
                mutationStatus = 'CONFLICT';
                errorCode = ErrorCode.TASK_CONFLICT;
              } else {
                mutationStatus = 'REJECTED';
                errorCode = ErrorCode.VALIDATION_ERROR;
              }
              errorMessage = msg;
            }
          } else if (entityType === 'attendance' && action === 'clock_in') {
            const attPayload = payload as any;
            const { error: rpcErr } = await adminClient.rpc('record_attendance_checkin', {
              p_organization_id: tenantId,
              p_user_id: user.id,
              p_latitude: attPayload?.latitude != null ? Number(attPayload.latitude) : null,
              p_longitude: attPayload?.longitude != null ? Number(attPayload.longitude) : null,
              p_accuracy_meters: attPayload?.accuracyMeters != null ? Number(attPayload.accuracyMeters) : null,
              p_captured_at: clientTimestamp || new Date().toISOString(),
              p_notes: attPayload?.notes || null,
            });

            if (rpcErr) {
              mutationStatus = 'REJECTED';
              errorCode = ErrorCode.VALIDATION_ERROR;
              errorMessage = rpcErr.message;
            }
          } else if (entityType === 'attendance' && action === 'clock_out') {
            const attPayload = payload as any;
            const { error: rpcErr } = await adminClient.rpc('record_attendance_checkout', {
              p_attendance_id: entityId,
              p_latitude: attPayload?.latitude != null ? Number(attPayload.latitude) : null,
              p_longitude: attPayload?.longitude != null ? Number(attPayload.longitude) : null,
              p_accuracy_meters: attPayload?.accuracyMeters != null ? Number(attPayload.accuracyMeters) : null,
              p_captured_at: clientTimestamp || new Date().toISOString(),
              p_notes: attPayload?.notes || null,
            });

            if (rpcErr) {
              mutationStatus = 'REJECTED';
              errorCode = ErrorCode.VALIDATION_ERROR;
              errorMessage = rpcErr.message;
            }
          } else if (entityType === 'visit' && action === 'checkin') {
            const visPayload = payload as any;
            const { error: rpcErr } = await adminClient.rpc('record_visit_checkin', {
              p_visit_id: entityId,
              p_worker_id: user.id,
              p_latitude: Number(visPayload?.latitude),
              p_longitude: Number(visPayload?.longitude),
              p_accuracy: Number(visPayload?.accuracyMeters || 10),
              p_client_captured_at: clientTimestamp || new Date().toISOString(),
              p_exception_reason: visPayload?.exceptionReason || null,
              p_device_metadata: visPayload?.deviceMetadata || {},
            });

            if (rpcErr) {
              mutationStatus = 'REJECTED';
              errorCode = ErrorCode.VALIDATION_ERROR;
              errorMessage = rpcErr.message;
            }
          }

          if (mutationStatus === 'APPLIED') {
            // 3. Record in offline_mutations for idempotency deduplication
            await adminClient.from('offline_mutations').insert({
              mutation_id: mutationId,
              idempotency_key: idempotencyKey,
              organization_id: tenantId,
              user_id: user.id,
              entity_type: entityType,
              entity_id: entityId,
              action,
              payload: payload || {},
              status: 'SYNCED',
              client_timestamp: clientTimestamp || new Date().toISOString(),
            });

            results.push({
              mutationId,
              idempotencyKey,
              status: 'APPLIED',
            });
          } else {
            results.push({
              mutationId,
              idempotencyKey,
              status: mutationStatus,
              error: {
                code: errorCode,
                message: errorMessage || 'Mutation could not be applied',
                request_id: idempotencyKey,
              },
            });
          }
        } catch (err: any) {
          results.push({
            mutationId,
            idempotencyKey,
            status: 'REJECTED',
            error: {
              code: ErrorCode.INTERNAL_ERROR,
              message: err?.message || 'Processing error',
              request_id: idempotencyKey,
            },
          });
        }
      } else {
        // Mock fallback mode
        results.push({
          mutationId,
          idempotencyKey,
          status: 'APPLIED',
        });
      }
    }

    const syncResponse: OfflineSyncResponse = {
      processed: results.length,
      results,
    };

    return NextResponse.json({
      success: true,
      data: syncResponse,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
