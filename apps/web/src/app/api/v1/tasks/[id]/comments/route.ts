import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbProfileToUserProfile,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { TaskComment, UUID, IsoDateTime, TaskId, UserId } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      const { data: comments, error } = await adminClient
        .from('task_comments')
        .select('*')
        .eq('task_id', params.id)
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: true });

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      const authorIds = (comments || []).map((c: any) => c.author_id);
      const { data: profiles } = await adminClient
        .from('profiles')
        .select('*')
        .in('user_id', authorIds);

      const profileMap = new Map<string, any>();
      (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

      const result: TaskComment[] = (comments || []).map((c: any) => {
        const prof = profileMap.get(c.author_id);
        return {
          id: c.id as UUID,
          taskId: c.task_id as TaskId,
          organizationId: c.organization_id,
          authorId: c.author_id as UserId,
          content: c.content,
          author: prof ? mapDbProfileToUserProfile(prof) : undefined,
          createdAt: c.created_at as IsoDateTime,
          updatedAt: c.updated_at as IsoDateTime,
        };
      });

      return NextResponse.json({ success: true, data: result });
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
    const content = body?.content?.trim();

    if (!content) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Comment content cannot be empty' } },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      // Verify task belongs to this organization
      const { data: task, error: taskErr } = await adminClient
        .from('tasks')
        .select('id')
        .eq('id', params.id)
        .eq('organization_id', tenantId)
        .maybeSingle();

      if (taskErr || !task) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
          { status: 404 }
        );
      }

      const { data: inserted, error: insertErr } = await adminClient
        .from('task_comments')
        .insert({
          task_id: params.id,
          organization_id: tenantId,
          author_id: user.id, // Strictly server-derived from authenticated user
          content,
        })
        .select()
        .single();

      if (insertErr || !inserted) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: insertErr?.message } },
          { status: 500 }
        );
      }

      await adminClient.from('task_activities').insert({
        task_id: params.id,
        organization_id: tenantId,
        actor_id: user.id,
        action: 'COMMENT_ADDED',
        details: { commentId: inserted.id },
      });

      const responseComment: TaskComment = {
        id: inserted.id as UUID,
        taskId: inserted.task_id as TaskId,
        organizationId: inserted.organization_id,
        authorId: user.id,
        content: inserted.content,
        author: user,
        createdAt: inserted.created_at as IsoDateTime,
        updatedAt: inserted.updated_at as IsoDateTime,
      };

      return NextResponse.json({ success: true, data: responseComment });
    }

    const fallbackComment: TaskComment = {
      id: `comm_${Date.now()}` as UUID,
      taskId: params.id as TaskId,
      organizationId: tenantId,
      authorId: user.id,
      content,
      author: user,
      createdAt: new Date().toISOString() as IsoDateTime,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };

    return NextResponse.json({ success: true, data: fallbackComment });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
