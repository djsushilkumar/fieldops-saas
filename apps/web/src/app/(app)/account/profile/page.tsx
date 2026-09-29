'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { updateProfileSchema } from '@fieldops/validation';
import { useAuth } from '@/lib/auth-context';
import { getProfileService } from '@/lib/api';
import { Button } from '@/components/ui/button';

type ProfileFormData = z.infer<typeof updateProfileSchema>;

export default function ProfilePage() {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      fullName: user?.fullName || '',
      displayName: user?.displayName || '',
      phone: user?.phone || '',
      timezone: user?.timezone || 'UTC',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const profileService = getProfileService();
      await profileService.updateProfile(data);
      setSuccessMessage('Profile details updated successfully.');
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to update profile. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-3 sm:p-6 lg:p-8">
      <div className="pb-6 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Your Profile</h1>
        <p className="mt-1 text-sm text-text-muted">
          Manage your operational identity and personal preferences.
        </p>
      </div>

      {successMessage && (
        <div className="mt-4 rounded-md bg-emerald-50 p-3 text-xs font-medium text-emerald-800 border border-emerald-200">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-xs font-medium text-red-800 border border-red-200">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-text-muted">Email (Immutable)</label>
          <input
            type="email"
            disabled
            value={user?.email || ''}
            className="mt-1 block w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
          />
          <p className="mt-1 text-[11px] text-text-muted">
            Email address is bound to your primary authentication identity.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-muted">Full Name</label>
          <input
            type="text"
            {...register('fullName')}
            className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
          {errors.fullName && (
            <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-muted">Display / Call Sign Name</label>
          <input
            type="text"
            {...register('displayName')}
            className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            placeholder="e.g. Unit 4, Charlie"
          />
          {errors.displayName && (
            <p className="mt-1 text-xs text-red-600">{errors.displayName.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-muted">Phone Number</label>
          <input
            type="tel"
            {...register('phone')}
            className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            placeholder="+1 (555) 000-0000"
          />
          {errors.phone && (
            <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-muted">Timezone</label>
          <input
            type="text"
            {...register('timezone')}
            className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
          {errors.timezone && (
            <p className="mt-1 text-xs text-red-600">{errors.timezone.message}</p>
          )}
        </div>

        <div className="pt-4 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="text-xs font-semibold"
          >
            {isSubmitting ? 'Saving Changes...' : 'Save Profile'}
          </Button>
        </div>
      </form>
    </div>
  );
}
