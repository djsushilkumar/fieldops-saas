'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { passwordSchema } from '@fieldops/validation';
import { getApiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';

const resetFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof resetFormSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const client = getApiClient();
      await client.put('/api/v1/auth/reset-password', {
        password: data.password,
      });
      setStatusMessage('Password updated successfully. Redirecting to sign in...');
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to reset password. Link may have expired.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-primary">Set New Password</h1>
          <p className="mt-2 text-sm text-text-muted">
            Enter a new password meeting FieldOps SaaS security criteria.
          </p>
        </div>

        {statusMessage && (
          <div className="mt-6 rounded-md bg-emerald-50 p-3 text-xs font-medium text-emerald-800 border border-emerald-200">
            {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 rounded-md bg-red-50 p-3 text-xs font-medium text-red-800 border border-red-200">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted">New Password</label>
            <input
              type="password"
              autoComplete="new-password"
              {...register('password')}
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted">Confirm Password</label>
            <input
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="w-full justify-center py-2 text-sm font-semibold"
          >
            {isSubmitting ? 'Updating Password...' : 'Save New Password'}
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-text-muted">
          Back to{' '}
          <Link href="/login" className="font-semibold text-brand-primary hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
