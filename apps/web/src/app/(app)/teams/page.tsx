'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { getTeamService } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Team,
  can,
  Permissions,
  UserRole,
} from '@fieldops/types';

export default function TeamsPage() {
  const { activeRole } = useAuth();
  const { activeOrganization } = useOrganization();

  const role = activeRole || UserRole.FIELD_WORKER;
  const canManageTeams = can(role, Permissions.TEAM_MANAGE);

  const [teams, setTeams] = useState<readonly Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Create Team Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTeams = useCallback(async () => {
    if (!activeOrganization) return;
    setIsLoading(true);
    setErrorMessage(null);

    const teamService = getTeamService();
    try {
      const data = await teamService.listTeams();
      setTeams(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load teams.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrganization]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      setCreateError('Team name is required.');
      return;
    }

    setCreateError(null);
    setIsSubmitting(true);
    const teamService = getTeamService();

    try {
      await teamService.createTeam({
        name: teamName.trim(),
        description: teamDescription.trim() || undefined,
      });

      setTeamName('');
      setTeamDescription('');
      setIsCreateModalOpen(false);
      loadTeams();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create team.';
      setCreateError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
              Workforce Organization
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {teams.length} Teams
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary">
            Teams & Territory Crews
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Organize field crews, assign territory leads, and route task buckets by team.
          </p>
        </div>

        {canManageTeams && (
          <Button
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
            className="h-8 px-3 text-xs"
          >
            + Create Team
          </Button>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {errorMessage}
        </div>
      )}

      {/* Teams Grid */}
      {isLoading ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-xs text-text-muted">
          Loading teams...
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-xs text-text-muted">
          <p className="font-semibold text-slate-700">No teams created yet</p>
          <p className="mt-1">Group field technicians into regional crews or specialty units.</p>
          {canManageTeams && (
            <div className="mt-4">
              <Button
                variant="primary"
                onClick={() => setIsCreateModalOpen(true)}
                className="h-8 text-xs"
              >
                + Create First Team
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-border bg-surface p-6 shadow-sm hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-bold text-base text-primary">{t.name}</h2>
                  <p className="mt-1 text-xs text-text-muted">
                    {t.description || 'No description provided.'}
                  </p>
                </div>
                <span className="rounded bg-brand-primary/10 px-2 py-0.5 text-[10px] font-bold text-brand-primary">
                  ACTIVE CREW
                </span>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs">
                <span className="text-text-muted">Team ID:</span>
                <code className="font-mono text-[11px] text-slate-600">{t.id.slice(0, 8)}</code>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Link href={`/tasks?assignedTeam=${t.id}`}>
                  <Button variant="secondary" className="h-7 px-2.5 text-xs">
                    Team Tasks
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h3 className="font-bold text-primary text-sm">Create New Team</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="mt-4 rounded-md bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateTeam} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Team Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metro Electricians, District 4 Maintenance"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Operational responsibilities, territory boundaries..."
                  value={teamDescription}
                  onChange={(e) => setTeamDescription(e.target.value)}
                  className="w-full rounded-md border border-input bg-surface px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Team'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
