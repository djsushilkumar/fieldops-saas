'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { passwordResetRequestSchema } from '@fieldops/validation';
import { getAuthService } from '@/lib/api';
import { Button } from '@/components/ui/button';

type ForgotPasswordFormData = z.infer<typeof passwordResetRequestSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const authService = getAuthService();
      await authService.requestPasswordReset(data.email);
      setSubmitted(true);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to request password reset. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-primary">Reset your password</h1>
          <p className="mt-2 text-sm text-text-muted">
            Enter your verified email address and we&apos;ll dispatch a recovery link.
          </p>
        </div>

        {submitted ? (
          <div className="mt-6 rounded-md bg-emerald-50 p-4 text-center border border-emerald-200">
            <h3 className="text-sm font-semibold text-emerald-800">Password Reset Dispatched</h3>
            <p className="mt-1 text-xs text-emerald-700">
              If an account matches that email address, you will receive password reset instructions shortly.
            </p>
            <div className="mt-4">
              <Link href="/login">
                <Button variant="secondary" className="text-xs">
                  Return to Sign In
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {errorMessage && (
              <div className="mt-6 rounded-md bg-red-50 p-3 text-xs font-medium text-red-800 border border-red-200">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted">Email Address</label>
                <input
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  placeholder="worker@company.com"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="w-full justify-center py-2 text-sm font-semibold"
              >
                {isSubmitting ? 'Dispatching Link...' : 'Send Recovery Link'}
              </Button>
            </form>

            <div className="mt-6 text-center text-xs text-text-muted">
              Remember your password?{' '}
              <Link href="/login" className="font-semibold text-brand-primary hover:underline">
                Sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
