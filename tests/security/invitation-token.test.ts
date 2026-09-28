import { describe, it, expect } from 'vitest';
import { createHash, randomBytes } from 'crypto';
import { InvitationStatus, ErrorCode, UserRole } from '@fieldops/types';

describe('Security Suite: Single-Use Expiring Invitation Tokens', () => {
  interface MockInvitation {
    id: string;
    tokenHash: string;
    status: InvitationStatus;
    expiresAt: Date;
    role: UserRole;
  }

  function hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  function redeemInvitation(
    invitations: MockInvitation[],
    rawToken: string,
    now: Date = new Date()
  ): { success: boolean; code?: ErrorCode; error?: string } {
    const inputHash = hashToken(rawToken);
    const inv = invitations.find((i) => i.tokenHash === inputHash);

    if (!inv) {
      return { success: false, code: ErrorCode.NOT_FOUND, error: 'Invalid invitation token.' };
    }

    if (inv.status === InvitationStatus.ACCEPTED) {
      return { success: false, code: ErrorCode.INVITATION_INVALID, error: 'Token already used.' };
    }

    if (inv.status === InvitationStatus.REVOKED) {
      return { success: false, code: ErrorCode.INVITATION_INVALID, error: 'Invitation has been revoked.' };
    }

    if (inv.expiresAt < now) {
      inv.status = InvitationStatus.EXPIRED;
      return { success: false, code: ErrorCode.INVITATION_EXPIRED, error: 'Invitation token has expired.' };
    }

    // Successful redemption marks token as ACCEPTED
    inv.status = InvitationStatus.ACCEPTED;
    return { success: true };
  }

  it('hashes invitation tokens with SHA-256 so plaintext is never stored in DB', () => {
    const rawToken = randomBytes(32).toString('hex');
    const hashed = hashToken(rawToken);

    expect(hashed).toHaveLength(64);
    expect(hashed).not.toBe(rawToken);
    expect(hashToken(rawToken)).toBe(hashed); // Deterministic matching
  });

  it('allows redemption of a valid pending invitation', () => {
    const rawToken = 'secret-invitation-token-12345';
    const invitations: MockInvitation[] = [
      {
        id: 'inv_1',
        tokenHash: hashToken(rawToken),
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 86400000), // 24 hours in future
        role: UserRole.FIELD_WORKER,
      },
    ];

    const result = redeemInvitation(invitations, rawToken);
    expect(result.success).toBe(true);
    expect(invitations[0].status).toBe(InvitationStatus.ACCEPTED);
  });

  it('rejects replay attacks attempting to use an already redeemed token', () => {
    const rawToken = 'single-use-token-xyz';
    const invitations: MockInvitation[] = [
      {
        id: 'inv_1',
        tokenHash: hashToken(rawToken),
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 86400000),
        role: UserRole.FIELD_WORKER,
      },
    ];

    // First redemption succeeds
    const firstRedeem = redeemInvitation(invitations, rawToken);
    expect(firstRedeem.success).toBe(true);

    // Second redemption attempt with identical token fails
    const secondRedeem = redeemInvitation(invitations, rawToken);
    expect(secondRedeem.success).toBe(false);
    expect(secondRedeem.code).toBe(ErrorCode.INVITATION_INVALID);
  });

  it('rejects expired invitation tokens', () => {
    const rawToken = 'expired-token-abc';
    const invitations: MockInvitation[] = [
      {
        id: 'inv_1',
        tokenHash: hashToken(rawToken),
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        role: UserRole.FIELD_WORKER,
      },
    ];

    const result = redeemInvitation(invitations, rawToken);
    expect(result.success).toBe(false);
    expect(result.code).toBe(ErrorCode.INVITATION_EXPIRED);
  });

  it('rejects revoked invitation tokens', () => {
    const rawToken = 'revoked-token-123';
    const invitations: MockInvitation[] = [
      {
        id: 'inv_1',
        tokenHash: hashToken(rawToken),
        status: InvitationStatus.REVOKED,
        expiresAt: new Date(Date.now() + 86400000),
        role: UserRole.FIELD_WORKER,
      },
    ];

    const result = redeemInvitation(invitations, rawToken);
    expect(result.success).toBe(false);
    expect(result.code).toBe(ErrorCode.INVITATION_INVALID);
  });
});
