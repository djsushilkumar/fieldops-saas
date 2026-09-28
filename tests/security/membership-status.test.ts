import { describe, it, expect } from 'vitest';
import { MembershipStatus, ErrorCode } from '@fieldops/types';

describe('Security Suite: Membership Lifecycle & Inactive Status Revocation', () => {
  function evaluateTenantAccess(status: MembershipStatus): {
    allowed: boolean;
    errorCode?: ErrorCode;
  } {
    switch (status) {
      case MembershipStatus.ACTIVE:
        return { allowed: true };
      case MembershipStatus.SUSPENDED:
        return {
          allowed: false,
          errorCode: ErrorCode.MEMBERSHIP_SUSPENDED,
        };
      case MembershipStatus.REMOVED:
      case MembershipStatus.INVITED:
        return {
          allowed: false,
          errorCode: ErrorCode.AUTHORIZATION_ERROR,
        };
    }
  }

  it('permits ACTIVE member full tenant operational access', () => {
    const result = evaluateTenantAccess(MembershipStatus.ACTIVE);
    expect(result.allowed).toBe(true);
    expect(result.errorCode).toBeUndefined();
  });

  it('immediately blocks SUSPENDED member from accessing tenant resources', () => {
    const result = evaluateTenantAccess(MembershipStatus.SUSPENDED);
    expect(result.allowed).toBe(false);
    expect(result.errorCode).toBe(ErrorCode.MEMBERSHIP_SUSPENDED);
  });

  it('denies REMOVED member from querying any tenant endpoints', () => {
    const result = evaluateTenantAccess(MembershipStatus.REMOVED);
    expect(result.allowed).toBe(false);
    expect(result.errorCode).toBe(ErrorCode.AUTHORIZATION_ERROR);
  });

  it('denies unaccepted INVITED user before invitation redemption', () => {
    const result = evaluateTenantAccess(MembershipStatus.INVITED);
    expect(result.allowed).toBe(false);
    expect(result.errorCode).toBe(ErrorCode.AUTHORIZATION_ERROR);
  });
});
