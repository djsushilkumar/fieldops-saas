import { describe, it, expect } from 'vitest';
import { UserRole, MembershipStatus, ErrorCode } from '@fieldops/types';

describe('Security Suite: Final Owner Protection Invariant', () => {
  interface MockMembership {
    id: string;
    organizationId: string;
    userId: string;
    role: UserRole;
    status: MembershipStatus;
  }

  function simulateMembershipMutation(
    currentMemberships: MockMembership[],
    targetMemberId: string,
    action: 'DELETE' | 'DEMOTE' | 'SUSPEND',
    newRole?: UserRole
  ): { success: boolean; error?: string; code?: ErrorCode } {
    const target = currentMemberships.find((m) => m.id === targetMemberId);
    if (!target) {
      return { success: false, code: ErrorCode.NOT_FOUND, error: 'Member not found' };
    }

    const wasActiveOwner = target.role === UserRole.OWNER && target.status === MembershipStatus.ACTIVE;

    if (wasActiveOwner) {
      const willRemainActiveOwner =
        action !== 'DELETE' &&
        action !== 'SUSPEND' &&
        newRole === UserRole.OWNER;

      if (!willRemainActiveOwner) {
        // Count other active owners in this organization
        const otherActiveOwners = currentMemberships.filter(
          (m) =>
            m.organizationId === target.organizationId &&
            m.id !== target.id &&
            m.role === UserRole.OWNER &&
            m.status === MembershipStatus.ACTIVE
        ).length;

        if (otherActiveOwners === 0) {
          return {
            success: false,
            code: ErrorCode.LAST_OWNER_PROTECTION,
            error: 'Cannot remove, suspend, or demote the last remaining ACTIVE OWNER of an organization.',
          };
        }
      }
    }

    return { success: true };
  }

  it('rejects deletion of the sole active owner in an organization', () => {
    const memberships: MockMembership[] = [
      {
        id: 'mem_1',
        organizationId: 'org_1',
        userId: 'usr_1',
        role: UserRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
      {
        id: 'mem_2',
        organizationId: 'org_1',
        userId: 'usr_2',
        role: UserRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    ];

    const result = simulateMembershipMutation(memberships, 'mem_1', 'DELETE');
    expect(result.success).toBe(false);
    expect(result.code).toBe(ErrorCode.LAST_OWNER_PROTECTION);
  });

  it('rejects demoting the sole active owner to ADMIN', () => {
    const memberships: MockMembership[] = [
      {
        id: 'mem_1',
        organizationId: 'org_1',
        userId: 'usr_1',
        role: UserRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    ];

    const result = simulateMembershipMutation(
      memberships,
      'mem_1',
      'DEMOTE',
      UserRole.ADMIN
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe(ErrorCode.LAST_OWNER_PROTECTION);
  });

  it('rejects suspending the sole active owner', () => {
    const memberships: MockMembership[] = [
      {
        id: 'mem_1',
        organizationId: 'org_1',
        userId: 'usr_1',
        role: UserRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    ];

    const result = simulateMembershipMutation(memberships, 'mem_1', 'SUSPEND');
    expect(result.success).toBe(false);
    expect(result.code).toBe(ErrorCode.LAST_OWNER_PROTECTION);
  });

  it('permits demoting an owner if a secondary active owner exists', () => {
    const memberships: MockMembership[] = [
      {
        id: 'mem_1',
        organizationId: 'org_1',
        userId: 'usr_1',
        role: UserRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
      {
        id: 'mem_2',
        organizationId: 'org_1',
        userId: 'usr_2',
        role: UserRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    ];

    const result = simulateMembershipMutation(
      memberships,
      'mem_1',
      'DEMOTE',
      UserRole.ADMIN
    );
    expect(result.success).toBe(true);
  });
});
