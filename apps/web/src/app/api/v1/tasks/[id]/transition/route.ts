import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbTaskToTask,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import {
  TaskStatus,
  isValidTaskTransition,
  UserRole,
} from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Establish tenant security context
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user, role } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  try {
    const body = await request.json();
    const targetStatus = body.status as TaskStatus;
    const blockedReason = body.blockedReason;
    const reopenReason = body.reopenReason;
    const expectedVersion = body.version != null ? Number(body.version) : null;

    if (!targetStatus) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Target status is required' } },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      // 2. Fetch current task to verify tenant isolation and role restrictions
      const { data: currentTask, error: fetchErr } = await adminClient
        .from('tasks')
        .select('*')
        .eq('id', params.id)
        .eq('organization_id', tenantId)
        .maybeSingle();

      if (fetchErr || !currentTask) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Task ${params.id} does not exist in this organization.`,
            },
          },
          { status: 404 }
        );
      }

      // Field Worker authority boundary: Can only transition tasks assigned to them
      if (role === UserRole.FIELD_WORKER && currentTask.assigned_to !== user.id) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Field workers can only transition tasks assigned to themselves.',
            },
          },
          { status: 403 }
        );
      }

      // Check incomplete checklists count
      const { count: incompleteCount } = await adminClient
        .from('task_checklists')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', params.id)
        .eq('is_required', true)
        .eq('is_completed', false);

      // Validate transition using canonical domain rules
      const validationResult = isValidTaskTransition(
        currentTask.status as TaskStatus,
        targetStatus,
        role,
        {
          blockedReason,
          reopenReason,
          incompleteRequiredChecklists: incompleteCount || 0,
        }
      );

      if (!validationResult.valid) {
        const isForbidden =
          validationResult.reason?.includes('cannot cancel') ||
          validationResult.reason?.includes('cannot reopen');
        return NextResponse.json(
          {
            success: false,
            error: {
              code: isForbidden ? 'FORBIDDEN' : 'INVALID_TRANSITION',
              message: validationResult.reason || 'Invalid task transition',
            },
          },
          { status: isForbidden ? 403 : 400 }
        );
      }

      // 3. Invoke Canonical Database Stored Procedure (transition_task_status)
      const { data: rpcResult, error: rpcError } = await adminClient.rpc(
        'transition_task_status',
        {
          p_task_id: params.id,
          p_target_status: targetStatus,
          p_actor_id: user.id,
          p_blocked_reason: blockedReason || null,
          p_reopen_reason: reopenReason || null,
          p_expected_version: expectedVersion,
        }
      );

      if (rpcError) {
        const msg = rpcError.message || '';
        let status = 400;
        let code = 'TRANSITION_ERROR';

        if (msg.includes('TASK_CONFLICT')) {
          status = 409;
          code = 'TASK_CONFLICT';
        } else if (msg.includes('TASK_NOT_FOUND')) {
          status = 404;
          code = 'NOT_FOUND';
        } else if (msg.includes('TASK_CHECKLIST_INCOMPLETE')) {
          status = 400;
          code = 'TASK_CHECKLIST_INCOMPLETE';
        }

        return NextResponse.json(
          { success: false, error: { code, message: msg } },
          { status }
        );
      }

      // Fetch updated checklists
      const { data: checklists } = await adminClient
        .from('task_checklists')
        .select('*')
        .eq('task_id', params.id)
        .order('position', { ascending: true });

      const updatedTask = mapDbTaskToTask(rpcResult, checklists || []);
      return NextResponse.json({ success: true, data: updatedTask });
    }

    // Isolated test fallback
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
