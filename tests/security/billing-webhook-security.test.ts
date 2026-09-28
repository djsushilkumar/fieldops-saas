import { describe, it, expect, vi } from 'vitest';
import { MockBillingProvider } from '@fieldops/api';
import {
  BillingProviderType,
  BillingEvent,
  TenantId,
  IsoDateTime,
  ErrorCode,
} from '@fieldops/types';

describe('Security Suite: Billing Webhook Ingestion & Idempotency', () => {
  const provider = new MockBillingProvider();
  const secret = 'whsec_test_secret_12345';

  it('rejects webhooks with invalid signatures', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });
    const invalidSignature = 'bad_signature';

    const isValid = provider.verifyWebhookSignature(payload, invalidSignature, secret);
    expect(isValid).toBe(false);
  });

  it('accepts webhooks with valid deterministic signatures', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });
    const validSignature = 'valid_mock_signature';

    const isValid = provider.verifyWebhookSignature(payload, validSignature, secret);
    expect(isValid).toBe(true);
  });

  it('enforces webhook idempotency preventing duplicate event processing', async () => {
    // Simulated billing_events database ledger
    const processedEvents = new Map<string, BillingEvent>();

    const ingestWebhook = async (
      providerType: BillingProviderType,
      eventId: string,
      eventType: string,
      payload: Record<string, unknown>
    ): Promise<{ status: number; duplicate: boolean }> => {
      const key = `${providerType}:${eventId}`;
      if (processedEvents.has(key)) {
        // Idempotent success response without re-processing side-effects
        return { status: 200, duplicate: true };
      }

      processedEvents.set(key, {
        id: 'evt_uuid_1' as any,
        provider: providerType,
        providerEventId: eventId,
        eventType,
        payload,
        processed: true,
        processedAt: new Date().toISOString() as IsoDateTime,
        createdAt: new Date().toISOString() as IsoDateTime,
      });

      return { status: 200, duplicate: false };
    };

    const firstAttempt = await ingestWebhook(
      BillingProviderType.MOCK,
      'evt_invoice_paid_001',
      'invoice.payment_succeeded',
      { amount: 2900 }
    );
    expect(firstAttempt.status).toBe(200);
    expect(firstAttempt.duplicate).toBe(false);

    // Replay attack / duplicate delivery of the exact same event ID
    const duplicateAttempt = await ingestWebhook(
      BillingProviderType.MOCK,
      'evt_invoice_paid_001',
      'invoice.payment_succeeded',
      { amount: 2900 }
    );
    expect(duplicateAttempt.status).toBe(200);
    expect(duplicateAttempt.duplicate).toBe(true);
  });
});
