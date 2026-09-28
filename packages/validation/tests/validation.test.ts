import { describe, it, expect } from 'vitest';
import {
  uuidSchema,
  isoDateTimeSchema,
  apiErrorResponseSchema,
  paginationParamsSchema,
} from '../src/index';
import { ErrorCode } from '@fieldops/types';

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
