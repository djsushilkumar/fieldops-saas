import { describe, it, expect } from 'vitest';
import {
  createLocationSchema,
  updateLocationSchema,
  createVisitSchema,
  updateVisitSchema,
  checkinSchema,
  checkoutSchema,
  createProofSchema,
  visitFilterSchema,
} from '../src/index';
import { ProofType, VisitStatus } from '@fieldops/types';

describe('Location Validation Schemas', () => {
  it('validates a valid location payload and applies default radius', () => {
    const valid = {
      name: 'Downtown Substation',
      address: '100 Main St, San Francisco, CA',
      latitude: 37.7749,
      longitude: -122.4194,
    };
    const parsed = createLocationSchema.parse(valid);
    expect(parsed.name).toBe('Downtown Substation');
    expect(parsed.latitude).toBe(37.7749);
    expect(parsed.longitude).toBe(-122.4194);
    expect(parsed.allowedRadiusMeters).toBe(100);
  });

  it('rejects latitude out of [-90, 90] bounds', () => {
    const invalid = {
      name: 'North Pole Beyond',
      latitude: 95.5,
      longitude: -122.4194,
    };
    expect(() => createLocationSchema.parse(invalid)).toThrow();
  });

  it('rejects longitude out of [-180, 180] bounds', () => {
    const invalid = {
      name: 'Far East Beyond',
      latitude: 37.7749,
      longitude: 185.0,
    };
    expect(() => createLocationSchema.parse(invalid)).toThrow();
  });

  it('rejects allowedRadiusMeters below 10 or above 50,000', () => {
    expect(() =>
      createLocationSchema.parse({
        name: 'Tiny Geofence',
        latitude: 37.7749,
        longitude: -122.4194,
        allowedRadiusMeters: 5,
      })
    ).toThrow();

    expect(() =>
      createLocationSchema.parse({
        name: 'Huge Geofence',
        latitude: 37.7749,
        longitude: -122.4194,
        allowedRadiusMeters: 60000,
      })
    ).toThrow();
  });
});

describe('Visit Validation Schemas', () => {
  const validLocationId = '11111111-1111-4111-8111-111111111111';

  it('validates a valid visit creation payload', () => {
    const valid = {
      locationId: validLocationId,
      scheduledStart: '2026-09-28T16:00:00.000Z',
      scheduledEnd: '2026-09-28T18:00:00.000Z',
    };
    const parsed = createVisitSchema.parse(valid);
    expect(parsed.locationId).toBe(validLocationId);
    expect(parsed.scheduledStart).toBe('2026-09-28T16:00:00.000Z');
  });

  it('rejects scheduledEnd that is earlier than scheduledStart', () => {
    const invalid = {
      locationId: validLocationId,
      scheduledStart: '2026-09-28T18:00:00.000Z',
      scheduledEnd: '2026-09-28T16:00:00.000Z',
    };
    expect(() => createVisitSchema.parse(invalid)).toThrow(
      'scheduledEnd must be at or after scheduledStart'
    );
  });

  it('rejects invalid non-UUID locationId', () => {
    const invalid = {
      locationId: 'not-a-uuid',
      scheduledStart: '2026-09-28T16:00:00.000Z',
    };
    expect(() => createVisitSchema.parse(invalid)).toThrow();
  });

  it('validates updateVisitSchema requiring optimistic concurrency version', () => {
    const validUpdate = {
      scheduledStart: '2026-09-28T17:00:00.000Z',
      version: 2,
    };
    const parsed = updateVisitSchema.parse(validUpdate);
    expect(parsed.version).toBe(2);

    expect(() =>
      updateVisitSchema.parse({
        scheduledStart: '2026-09-28T17:00:00.000Z',
      })
    ).toThrow('Version is required');
  });
});

describe('Check-In & Check-Out Validation Schemas', () => {
  it('validates legitimate check-in payload', () => {
    const validCheckin = {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracyMeters: 12.5,
      clientCapturedAt: '2026-09-28T16:05:00.000Z',
      deviceMetadata: { platform: 'ios', model: 'iPhone 15' },
    };
    const parsed = checkinSchema.parse(validCheckin);
    expect(parsed.accuracyMeters).toBe(12.5);
    expect(parsed.deviceMetadata).toBeDefined();
  });

  it('rejects check-in with negative accuracy or out of bounds coordinates', () => {
    expect(() =>
      checkinSchema.parse({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracyMeters: -5,
        clientCapturedAt: '2026-09-28T16:05:00.000Z',
      })
    ).toThrow();

    expect(() =>
      checkinSchema.parse({
        latitude: -100,
        longitude: -122.4194,
        accuracyMeters: 10,
        clientCapturedAt: '2026-09-28T16:05:00.000Z',
      })
    ).toThrow();
  });

  it('validates check-out payload with optional notes', () => {
    const validCheckout = {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracyMeters: 8.0,
      clientCapturedAt: '2026-09-28T17:30:00.000Z',
      notes: 'Job completed according to work order.',
    };
    const parsed = checkoutSchema.parse(validCheckout);
    expect(parsed.notes).toBe('Job completed according to work order.');
  });
});

describe('Proof of Work Schemas', () => {
  it('validates PHOTO proof with storagePath', () => {
    const validPhoto = {
      proofType: ProofType.PHOTO,
      storagePath: 'tenants/t1/visits/v1/photos/proof1.jpg',
      fileName: 'proof1.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: 1024 * 500,
    };
    expect(createProofSchema.parse(validPhoto)).toBeDefined();

    // Rejects PHOTO proof without storagePath
    expect(() =>
      createProofSchema.parse({
        proofType: ProofType.PHOTO,
      })
    ).toThrow('Missing required fields');
  });

  it('validates SIGNATURE proof with signerName and storagePath', () => {
    const validSignature = {
      proofType: ProofType.SIGNATURE,
      signerName: 'Jane Customer',
      storagePath: 'tenants/t1/visits/v1/signatures/sig1.png',
    };
    expect(createProofSchema.parse(validSignature)).toBeDefined();

    // Rejects SIGNATURE proof without signerName
    expect(() =>
      createProofSchema.parse({
        proofType: ProofType.SIGNATURE,
        storagePath: 'path.png',
      })
    ).toThrow('Missing required fields');
  });

  it('validates NOTE proof with non-empty notes', () => {
    const validNote = {
      proofType: ProofType.NOTE,
      notes: 'Customer confirmed all items delivered.',
    };
    expect(createProofSchema.parse(validNote)).toBeDefined();

    // Rejects NOTE proof without notes
    expect(() =>
      createProofSchema.parse({
        proofType: ProofType.NOTE,
      })
    ).toThrow('Missing required fields');
  });
});
