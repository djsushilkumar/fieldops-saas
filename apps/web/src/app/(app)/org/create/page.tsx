'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createOrganizationSchema } from '@fieldops/validation';
import { getOrganizationService } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { Button } from '@/components/ui/button';

type CreateOrgFormData = z.infer<typeof createOrganizationSchema>;

export default function CreateOrganizationPage() {
  const router = useRouter();
  const { setActiveMembership } = useAuth();
  const { switchOrganization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateOrgFormData>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: '',
      slug: '',
    },
  });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue('name', val);
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setValue('slug', slug, { shouldValidate: true });
  };

  const onSubmit = async (data: CreateOrgFormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const orgService = getOrganizationService();
      const result = await orgService.createOrganization({
        name: data.name,
        slug: data.slug,
        settings: {
          allowedRadiusMeters: 100,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        },
      });

      // Bind newly created membership and switch tenant
      setActiveMembership(result.membership);
      await switchOrganization(result.organization.id);
      router.push('/dashboard');
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to create organization. Slug may already be in use.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg p-3 sm:p-6 lg:p-8">
      <div className="pb-6 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Create an Organization</h1>
        <p className="mt-1 text-sm text-text-muted">
          Bootstrap a new operational tenant. You will be assigned as the Organization Owner.
        </p>
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-xs font-medium text-red-800 border border-red-200">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-text-muted">Organization Name</label>
          <input
            type="text"
            onChange={handleNameChange}
            className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            placeholder="Midwest Field Services Inc."
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-muted">Tenant Slug</label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <span className="inline-flex items-center rounded-l-md border border-r-0 border-border bg-slate-50 px-3 text-xs text-text-muted">
              fieldops.io/
            </span>
            <input
              type="text"
              {...register('slug')}
              className="block w-full flex-1 rounded-none rounded-r-md border border-border px-3 py-2 text-sm text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              placeholder="midwest-field"
            />
          </div>
          {errors.slug && (
            <p className="mt-1 text-xs text-red-600">{errors.slug.message}</p>
          )}
        </div>

        <div className="pt-4 flex items-center justify-between">
          <Link href="/org/select">
            <Button type="button" variant="secondary" className="text-xs">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="text-xs font-semibold"
          >
            {isSubmitting ? 'Creating Organization...' : 'Create & Enter'}
          </Button>
        </div>
      </form>
    </div>
  );
}
