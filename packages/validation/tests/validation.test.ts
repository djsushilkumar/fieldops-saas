import { describe, it, expect } from 'vitest';
import {
  uuidSchema,
  isoDateTimeSchema,
  apiErrorResponseSchema,
  paginationParamsSchema,
  slugSchema,
  emailSchema,
  passwordSchema,
  signUpSchema,
  signInSchema,
  createOrganizationSchema,
  inviteMemberSchema,
  acceptInvitationSchema,
  updateMemberStatusSchema,
} from '../src/index';
import { ErrorCode, UserRole, MembershipStatus } from '@fieldops/types';

describe('Validation Architecture', () => {
  it('validates canonical UUIDs successfully', () => {
    const validUuid = '018f2e23-74d3-7d24-811c-d7e174244d28';
    const result = uuidSchema.safeParse(validUuid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(validUuid);
    }
  });

  it('rejects invalid UUID strings', () => {
    const invalidUuid = 'not-a-uuid-string';
    const result = uuidSchema.safeParse(invalidUuid);
    expect(result.success).toBe(false);
  });

  it('validates ISO-8601 UTC timestamps', () => {
    const validTimestamp = '2026-09-28T16:00:00.000Z';
    const result = isoDateTimeSchema.safeParse(validTimestamp);
    expect(result.success).toBe(true);
  });

  it('rejects non-ISO date strings', () => {
    const invalidTimestamp = '09/28/2026 4:00 PM';
    const result = isoDateTimeSchema.safeParse(invalidTimestamp);
    expect(result.success).toBe(false);
  });

  it('validates structured API error envelopes with stable ErrorCodes', () => {
    const errorPayload = {
      success: false,
      error: {
        code: ErrorCode.AUTHORIZATION_ERROR,
        message: 'Forbidden tenant resource access.',
        request_id: 'req_123456789',
      },
    };

    const result = apiErrorResponseSchema.safeParse(errorPayload);
    expect(result.success).toBe(true);
  });

  it('validates default pagination parameters', () => {
    const defaultParams = paginationParamsSchema.parse({});
    expect(defaultParams.page).toBe(1);
    expect(defaultParams.pageSize).toBe(20);
  });
});

describe('Phase 03 Identity & Access Validation', () => {
  describe('slugSchema', () => {
    it('accepts valid tenant slugs', () => {
      expect(slugSchema.safeParse('acme-corp').success).toBe(true);
      expect(slugSchema.safeParse('fieldops-us-east-1').success).toBe(true);
      expect(slugSchema.safeParse('team123').success).toBe(true);
    });

    it('normalizes uppercase slugs to lowercase', () => {
      const parsed = slugSchema.safeParse('ACME-Corp');
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toBe('acme-corp');
      }
    });

    it('rejects invalid slugs', () => {
      expect(slugSchema.safeParse('ab').success).toBe(false); // too short
      expect(slugSchema.safeParse('-leading-hyphen').success).toBe(false);
      expect(slugSchema.safeParse('trailing-hyphen-').success).toBe(false);
      expect(slugSchema.safeParse('double--hyphen').success).toBe(false);
      expect(slugSchema.safeParse('with spaces').success).toBe(false);
      expect(slugSchema.safeParse('invalid_underscore').success).toBe(false);
    });
  });

  describe('emailSchema', () => {
    it('accepts and normalizes valid email addresses', () => {
      const parsed = emailSchema.safeParse('  Worker.One@FieldOps.IO  ');
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toBe('worker.one@fieldops.io');
      }
    });

    it('rejects malformed email addresses', () => {
      expect(emailSchema.safeParse('not-an-email').success).toBe(false);
      expect(emailSchema.safeParse('@fieldops.io').success).toBe(false);
      expect(emailSchema.safeParse('worker@').success).toBe(false);
    });
  });

  describe('passwordSchema', () => {
    it('accepts strong passwords meeting SaaS baseline policy', () => {
      expect(passwordSchema.safeParse('SecureP@ssw0rd!').success).toBe(true);
      expect(passwordSchema.safeParse('F1eld-0ps-R0cks#').success).toBe(true);
    });

    it('rejects weak passwords missing required character classes', () => {
      expect(passwordSchema.safeParse('short1!').success).toBe(false); // < 8 chars
      expect(passwordSchema.safeParse('alllowercase1!').success).toBe(false); // no uppercase
      expect(passwordSchema.safeParse('ALLUPPERCASE1!').success).toBe(false); // no lowercase
      expect(passwordSchema.safeParse('NoDigitsHere!').success).toBe(false); // no digit
      expect(passwordSchema.safeParse('NoSpecialChar123').success).toBe(false); // no symbol
    });
  });

  describe('signUpSchema & signInSchema', () => {
    it('validates a complete signup payload', () => {
      const payload = {
        email: 'founder@newcorp.com',
        password: 'Password123!',
        fullName: 'Jane Founder',
        organizationName: 'New Corp',
        organizationSlug: 'new-corp',
      };
      const result = signUpSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('validates signin credentials payload', () => {
      const valid = signInSchema.safeParse({
        email: 'alice@fieldops.io',
        password: 'Password123!',
      });
      expect(valid.success).toBe(true);

      const invalid = signInSchema.safeParse({
        email: 'invalid-email',
        password: '',
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('createOrganizationSchema & inviteMemberSchema', () => {
    it('validates organization creation parameters', () => {
      const result = createOrganizationSchema.safeParse({
        name: 'Apex Field Services',
        slug: 'apex-field',
        settings: { allowedRadiusMeters: 250, timezone: 'America/Chicago' },
      });
      expect(result.success).toBe(true);
    });

    it('validates member invitation payload', () => {
      const result = inviteMemberSchema.safeParse({
        email: 'technician@apex.com',
        role: UserRole.FIELD_WORKER,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invitation with invalid role', () => {
      const result = inviteMemberSchema.safeParse({
        email: 'technician@apex.com',
        role: 'SUPERADMIN',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('acceptInvitationSchema & updateMemberStatusSchema', () => {
    it('validates token redemption format', () => {
      const result = acceptInvitationSchema.safeParse({
        token: 'token_abcdef1234567890',
        fullName: 'New Employee',
      });
      expect(result.success).toBe(true);
    });

    it('validates member status mutation constraints', () => {
      expect(updateMemberStatusSchema.safeParse({ status: MembershipStatus.SUSPENDED }).success).toBe(true);
      expect(updateMemberStatusSchema.safeParse({ status: MembershipStatus.REMOVED }).success).toBe(true);
      expect(updateMemberStatusSchema.safeParse({ status: MembershipStatus.ACTIVE }).success).toBe(true);
      // Cannot manually transition status directly to INVITED
      expect(updateMemberStatusSchema.safeParse({ status: MembershipStatus.INVITED }).success).toBe(false);
    });
  });
});
