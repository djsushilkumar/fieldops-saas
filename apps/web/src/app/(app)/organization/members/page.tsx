'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { inviteMemberSchema } from '@fieldops/validation';
import {
  Membership,
  UserRole,
  MembershipStatus,
  can,
  Permissions,
  UUID,
} from '@fieldops/types';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { getMembershipService } from '@/lib/api';
import { Button } from '@/components/ui/button';

type InviteFormData = z.infer<typeof inviteMemberSchema>;

export default function MembersPage() {
  const { activeRole, user } = useAuth();
  const { activeOrganization } = useOrganization();

  const [members, setMembers] = useState<readonly Membership[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const role = activeRole || UserRole.FIELD_WORKER;
  const canInvite = can(role, Permissions.MEMBER_INVITE);
  const canAssignRole = can(role, Permissions.MEMBER_ROLE_ASSIGN);
  const canDeactivate = can(role, Permissions.MEMBER_DEACTIVATE);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      email: '',
      role: UserRole.FIELD_WORKER,
    },
  });

  const fetchMembers = useCallback(async () => {
    if (!activeOrganization) return;
    setIsLoading(true);
    try {
      const membershipService = getMembershipService();
      const list = await membershipService.listMembers(activeOrganization.id);
      setMembers(list);
      setErrorMessage(null);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load organization members');
    } finally {
      setIsLoading(false);
    }
  }, [activeOrganization]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const onInviteSubmit = async (data: InviteFormData) => {
    if (!activeOrganization) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const membershipService = getMembershipService();
      await membershipService.inviteMember(activeOrganization.id, data);
      setSuccessMessage(`Invitation dispatched to ${data.email}`);
      setShowInviteModal(false);
      reset();
      await fetchMembers();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to dispatch invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (memberId: UUID, targetStatus: MembershipStatus) => {
    if (!activeOrganization) return;
    try {
      const membershipService = getMembershipService();
      await membershipService.updateMemberStatus(activeOrganization.id, memberId, targetStatus);
      setSuccessMessage(`Member status transitioned to ${targetStatus}`);
      await fetchMembers();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update member status');
    }
  };

  const handleRoleChange = async (memberId: UUID, targetRole: UserRole) => {
    if (!activeOrganization) return;
    try {
      const membershipService = getMembershipService();
      await membershipService.updateMemberRole(activeOrganization.id, memberId, targetRole);
      setSuccessMessage(`Member role changed to ${targetRole}`);
      await fetchMembers();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update member role');
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="flex items-center justify-between pb-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Members & Access Control</h1>
          <p className="mt-1 text-sm text-text-muted">
            Manage personnel, system roles, and tenant memberships for{' '}
            <strong>{activeOrganization?.name}</strong>.
          </p>
        </div>

        {canInvite && (
          <Button
            variant="primary"
            className="text-xs"
            onClick={() => setShowInviteModal(true)}
          >
            + Invite Member
          </Button>
        )}
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

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
            <h2 className="text-lg font-bold text-primary">Invite New Member</h2>
            <p className="mt-1 text-xs text-text-muted">
              A secure, single-use cryptographic invitation link will be issued.
            </p>

            <form onSubmit={handleSubmit(onInviteSubmit)} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted">Email Address</label>
                <input
                  type="email"
                  {...register('email')}
                  className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm text-primary placeholder-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  placeholder="technician@fieldops.io"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted">Assigned System Role</label>
                <select
                  {...register('role')}
                  className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                >
                  <option value={UserRole.FIELD_WORKER}>Field Worker (Tasks & Check-Ins)</option>
                  <option value={UserRole.SUPERVISOR}>Supervisor (Direct Team Oversight)</option>
                  <option value={UserRole.MANAGER}>Manager (Department Operations)</option>
                  <option value={UserRole.ADMIN}>Admin (Operations & User Mgmt)</option>
                  {role === UserRole.OWNER && (
                    <option value={UserRole.OWNER}>Owner (Full Authority)</option>
                  )}
                </select>
                {errors.role && (
                  <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs"
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                  className="text-xs"
                >
                  {isSubmitting ? 'Dispatching...' : 'Dispatch Invitation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Roster Table */}
      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-text-muted">
            Loading tenant members...
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted">
            No active members found for this organization.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-slate-50 font-semibold text-text-muted">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">System Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => {
                const isCurrentUser = m.userId === user?.id;
                const isOwner = m.role === UserRole.OWNER;
                const canModifyThisMember =
                  (canAssignRole || canDeactivate) &&
                  !isCurrentUser &&
                  !(role === UserRole.ADMIN && isOwner);

                return (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-primary">
                      <div>
                        <span>{m.user?.fullName || `User ${m.userId.slice(0, 8)}`}</span>
                        {isCurrentUser && (
                          <span className="ml-2 text-[10px] text-brand-primary font-bold">(You)</span>
                        )}
                      </div>
                      <span className="text-[11px] text-text-muted">{m.user?.email || m.userId}</span>
                    </td>

                    <td className="px-4 py-3">
                      {canModifyThisMember && canAssignRole ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.id, e.target.value as UserRole)}
                          className="rounded border border-border bg-white px-2 py-1 text-xs font-semibold text-primary"
                        >
                          <option value={UserRole.FIELD_WORKER}>FIELD_WORKER</option>
                          <option value={UserRole.SUPERVISOR}>SUPERVISOR</option>
                          <option value={UserRole.MANAGER}>MANAGER</option>
                          <option value={UserRole.ADMIN}>ADMIN</option>
                          {role === UserRole.OWNER && <option value={UserRole.OWNER}>OWNER</option>}
                        </select>
                      ) : (
                        <span className="rounded bg-brand-primary/10 px-2 py-0.5 text-xs font-bold text-brand-primary">
                          {m.role}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          m.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : m.status === 'SUSPENDED'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      {canModifyThisMember && canDeactivate && (
                        <div className="flex justify-end gap-1.5">
                          {m.status === 'ACTIVE' ? (
                            <Button
                              variant="secondary"
                              className="h-7 px-2 text-[10px] text-amber-700 hover:bg-amber-100"
                              onClick={() => handleStatusChange(m.id, MembershipStatus.SUSPENDED)}
                            >
                              Suspend
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              className="h-7 px-2 text-[10px] text-emerald-700 hover:bg-emerald-100"
                              onClick={() => handleStatusChange(m.id, MembershipStatus.ACTIVE)}
                            >
                              Reactivate
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
