'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signUpSchema } from '@fieldops/validation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

type SignUpFormData = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
  const router = useRouter();
  const { signUp, error: authError, clearError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      password: '',
      fullName: '',
      organizationName: '',
      organizationSlug: '',
    },
  });

  const orgName = watch('organizationName');

  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue('organizationName', val);
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setValue('organizationSlug', slug, { shouldValidate: true });
  };

  const onSubmit = async (data: SignUpFormData) => {
    setIsSubmitting(true);
    setFormError(null);
    clearError();

    try {
      await signUp(data);
      router.push('/dashboard');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-primary">Get started with FieldOps</h1>
          <p className="mt-2 text-sm text-text-muted">
            Create your owner account and bootstrap your organization workspace.
          </p>
        </div>

        {(formError || authError) && (
          <div className="mt-6 rounded-md bg-red-50 p-3 text-xs font-medium text-red-800 border border-red-200">
            {formError || authError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-text-muted">Your Full Name</label>
              <input
                type="text"
                autoComplete="name"
                {...register('fullName')}
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                placeholder="Alex Morgan"
              />
              {errors.fullName && (
                <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted">Work Email</label>
              <input
                type="email"
                autoComplete="email"
                {...register('email')}
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                placeholder="alex@acmeservices.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted">Password</label>
            <input
              type="password"
              autoComplete="new-password"
              {...register('password')}
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              placeholder="Min. 8 characters (upper, lower, digit, symbol)"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div className="pt-2 border-t border-border">
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">
              Organization Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted">
                  Company / Organization Name
                </label>
                <input
                  type="text"
                  value={orgName || ''}
                  onChange={handleOrgNameChange}
                  className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  placeholder="Acme Operations Ltd."
                />
                {errors.organizationName && (
                  <p className="mt-1 text-xs text-red-600">{errors.organizationName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted">
                  Organization Slug (Tenant Domain)
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <span className="inline-flex items-center rounded-l-md border border-r-0 border-border bg-slate-50 px-3 text-xs text-text-muted">
                    fieldops.io/
                  </span>
                  <input
                    type="text"
                    {...register('organizationSlug')}
                    className="block w-full flex-1 rounded-none rounded-r-md border border-border px-3 py-2 text-sm text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    placeholder="acme-ops"
                  />
                </div>
                {errors.organizationSlug && (
                  <p className="mt-1 text-xs text-red-600">{errors.organizationSlug.message}</p>
                )}
              </div>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="w-full justify-center py-2 text-sm font-semibold mt-6"
          >
            {isSubmitting ? 'Creating Organization...' : 'Complete Registration'}
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-text-muted">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
