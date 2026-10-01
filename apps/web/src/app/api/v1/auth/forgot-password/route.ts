import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient, isSupabaseConfigured } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body?.email;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Email address is required' },
        },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      const admin = getSupabaseAdminClient();
      await admin.auth.resetPasswordForEmail(email.toLowerCase().trim());
    }

    return NextResponse.json({
      success: true,
      data: { success: true, message: 'If an account exists, a reset link has been dispatched.' },
    });
  } catch {
    return NextResponse.json({
      success: true,
      data: { success: true, message: 'If an account exists, a reset link has been dispatched.' },
    });
  }
}
