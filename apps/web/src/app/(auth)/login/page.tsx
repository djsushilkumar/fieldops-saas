'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signInSchema } from '@fieldops/validation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

type SignInFormData = z.infer<typeof signInSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/dashboard';

  const { signIn, error: authError, clearError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: SignInFormData) => {
    setIsSubmitting(true);
    setFormError(null);
    clearError();

    try {
      await signIn(data);
      router.push(redirectPath);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Invalid credentials. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-primary">Sign in to FieldOps</h1>
          <p className="mt-2 text-sm text-text-muted">
            Enter your operational credentials to access your tenant console.
          </p>
        </div>

        {(formError || authError) && (
          <div className="mt-6 rounded-md bg-red-50 p-3 text-xs font-medium text-red-800 border border-red-200">
            {formError || authError}
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

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-text-muted">Password</label>
              <Link
                href="/forgot-password"
                className="text-xs text-brand-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="w-full justify-center py-2 text-sm font-semibold"
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-semibold text-brand-primary hover:underline">
            Register your organization
          </Link>
        </div>
      </div>
    </div>
  );
}
