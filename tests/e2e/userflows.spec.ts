import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://fieldops-saas-seven.vercel.app';

test.describe('FieldOps Multi-Persona End-to-End Userflow Audit', () => {
  const timestamp = Date.now();
  const testEmail = `owner_${timestamp}@fieldops-saas.internal`;
  const adminEmail = `admin_${timestamp}@fieldops-saas.internal`;
  const workerEmail = `worker_${timestamp}@fieldops-saas.internal`;
  const password = 'TestSecurePassword123!';
  const orgName = `Enterprise Grid Solutions ${timestamp}`;
  const orgSlug = `grid-sol-${timestamp}`;

  let tenantId = '';
  let ownerToken = '';
  let adminToken = '';
  let workerToken = '';
  let createdLocationId = '';
  let createdTaskId = '';
  let createdVisitId = '';
  let checklistItemIds: string[] = [];
  let shiftId = '';

  // =========================================================================
  // 1. OWNER PERSONA USER FLOWS
  // =========================================================================
  test.describe('1. OWNER PERSONA FLOW', () => {
    test('1.1 Owner registers new tenant organization and verifies session', async ({ request }) => {
      // Signup as Owner
      const signupRes = await request.post(`${BASE_URL}/api/v1/auth/signup`, {
        data: {
          email: testEmail,
          password,
          fullName: 'Vikramaditya Singhania (Managing Director)',
          organizationName: orgName,
          organizationSlug: orgSlug,
        },
      });

      expect(signupRes.ok()).toBeTruthy();
      const signupBody = await signupRes.json();
      expect(signupBody.success).toBe(true);
      expect(signupBody.data.activeMembership.role).toBe('OWNER');
      expect(signupBody.data.activeMembership.organization.id).toBeDefined();

      tenantId = signupBody.data.activeMembership.organization.id;
      ownerToken = signupBody.data.tokens.accessToken;

      // Verify Session with Tenant Header
      const sessionRes = await request.get(`${BASE_URL}/api/v1/auth/session`, {
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
          'x-tenant-id': tenantId,
        },
      });

      expect(sessionRes.ok()).toBeTruthy();
      const sessionBody = await sessionRes.json();
      expect(sessionBody.success).toBe(true);
      expect(sessionBody.data.user.email).toBe(testEmail);
    });

    test('1.2 Owner accesses management pages and billing quotas', async ({ request }) => {
      const pages = ['/dashboard', '/tasks', '/visits', '/locations', '/map', '/calendar', '/attendance', '/settings/billing'];
      for (const p of pages) {
        const res = await request.get(`${BASE_URL}${p}`);
        expect(res.status()).toBe(200);
      }

      // Check Billing Overview
      const billingRes = await request.get(`${BASE_URL}/api/v1/billing/overview`, {
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
          'x-tenant-id': tenantId,
        },
      });
      expect(billingRes.ok()).toBeTruthy();
      const billingBody = await billingRes.json();
      expect(billingBody.success).toBe(true);
      expect(billingBody.data.subscription.plan).toBeDefined();
    });

    test('1.3 Owner creates Unolo Client Site with 100m geofence radius', async ({ request }) => {
      const locPayload = {
        name: 'Apex Industrial Telematics Yard',
        address: 'Plot 44, Okhla Industrial Area Phase III, New Delhi',
        latitude: 28.5356,
        longitude: 77.2681,
        allowedRadiusMeters: 100,
      };

      const res = await request.post(`${BASE_URL}/api/v1/locations`, {
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
          'x-tenant-id': tenantId,
        },
        data: locPayload,
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.allowedRadiusMeters).toBe(100);
      createdLocationId = body.data.id;
    });

    test('1.4 Owner creates TaskOPad Work Order with multi-step interactive checklists', async ({ request }) => {
      const taskPayload = {
        title: 'Emergency Generator 500kVA ATS Diagnostic & Fuel Flow Inspection',
        description: 'Verify automatic load transfer switch, inspect fuel line pressures, and certify ATS relays.',
        priority: 'URGENT',
        dueAt: new Date(Date.now() + 24 * 3600000).toISOString(),
        locationId: createdLocationId,
        locationName: 'Apex Industrial Telematics Yard',
        checklists: [
          { title: 'Lockout electrical main circuit breaker', isRequired: true },
          { title: 'Measure diesel line bar pressure (>3.2 bar)', isRequired: true },
          { title: 'Execute simulated utility power cut drill', isRequired: true },
          { title: 'Capture high-res thermal image of busbars', isRequired: false },
        ],
      };

      const res = await request.post(`${BASE_URL}/api/v1/tasks`, {
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
          'x-tenant-id': tenantId,
        },
        data: taskPayload,
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.status).toBe('ASSIGNED');
      expect(body.data.priority).toBe('URGENT');
      expect(body.data.checklists.length).toBe(4);

      createdTaskId = body.data.id;
      checklistItemIds = body.data.checklists.map((c: any) => c.id);
    });

    test('1.5 Owner schedules Unolo Field Visit linked to the client site and task', async ({ request }) => {
      const visitPayload = {
        locationId: createdLocationId,
        taskId: createdTaskId,
        scheduledStart: new Date(Date.now() + 3600000).toISOString(),
        scheduledEnd: new Date(Date.now() + 4 * 3600000).toISOString(),
        notes: 'Mandatory safety goggles and insulated gloves required.',
      };

      const res = await request.post(`${BASE_URL}/api/v1/visits`, {
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
          'x-tenant-id': tenantId,
        },
        data: visitPayload,
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.status).toBe('SCHEDULED');
      createdVisitId = body.data.id;
    });

    test('1.6 Owner verifies Real-time Operations Dashboard KPIs', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/v1/dashboard/kpis`, {
        headers: {
          'Authorization': `Bearer ${ownerToken}`,
          'x-tenant-id': tenantId,
        },
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.tasksToday).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 2. ADMIN / DISPATCHER PERSONA USER FLOWS
  // =========================================================================
  test.describe('2. ADMIN / DISPATCHER PERSONA FLOW', () => {
    test('2.1 Admin authenticates and accesses dispatch operations', async ({ request }) => {
      // Create Admin account under same tenant
      const adminSignupRes = await request.post(`${BASE_URL}/api/v1/auth/signup`, {
        data: {
          email: adminEmail,
          password,
          fullName: 'Arjun Mehra (Operations Dispatcher)',
          organizationName: orgName,
          organizationSlug: orgSlug,
        },
      });

      expect(adminSignupRes.ok()).toBeTruthy();
      const body = await adminSignupRes.json();
      adminToken = body.data.tokens.accessToken;
    });

    test('2.2 Admin retrieves TaskOPad Kanban Board and filters by Priority', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/v1/tasks?priority=URGENT`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'x-tenant-id': tenantId,
        },
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    test('2.3 Admin reassigns task to field technician and updates notes', async ({ request }) => {
      const res = await request.patch(`${BASE_URL}/api/v1/tasks/${createdTaskId}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'x-tenant-id': tenantId,
        },
        data: {
          assignedTo: 'usr_tech_rajesh',
          assignedToName: 'Rajesh Kumar (Field Specialist)',
          description: 'UPDATED BY DISPATCH: Verify ATS emergency solenoid disconnect circuit before breaker trip.',
        },
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.assignedToName).toContain('Rajesh Kumar');
    });

    test('2.4 Admin adds a coordination comment to the work order', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/v1/tasks/${createdTaskId}/comments`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'x-tenant-id': tenantId,
        },
        data: {
          content: 'Dispatch update: Facility manager Mr. Alok Verma is available on-site at gate 2.',
        },
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.content).toContain('Alok Verma');
    });
  });

  // =========================================================================
  // 3. EMPLOYEE / FIELD WORKER PERSONA USER FLOWS
  // =========================================================================
  test.describe('3. EMPLOYEE / FIELD WORKER PERSONA FLOW', () => {
    test('3.1 Employee registers / logs in for duty shift', async ({ request }) => {
      const workerSignupRes = await request.post(`${BASE_URL}/api/v1/auth/signup`, {
        data: {
          email: workerEmail,
          password,
          fullName: 'Rajesh Kumar (Field Specialist)',
          organizationName: orgName,
          organizationSlug: orgSlug,
        },
      });
      expect(workerSignupRes.ok()).toBeTruthy();
      const workerBody = await workerSignupRes.json();
      workerToken = workerBody.data.tokens.accessToken;
    });

    test('3.2 Employee clocks in for duty shift with GPS coordinates', async ({ request }) => {
      const clockInPayload = {
        latitude: 28.5355,
        longitude: 77.2680,
        accuracyMeters: 8.5,
        notes: 'Shift started on mobile device at Okhla base.',
      };

      const res = await request.post(`${BASE_URL}/api/v1/attendance/clock-in`, {
        headers: {
          'Authorization': `Bearer ${workerToken}`,
          'x-tenant-id': tenantId,
        },
        data: clockInPayload,
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('CLOCKED_IN');
      expect(body.data.checkInLatitude).toBeCloseTo(28.5355, 3);
      shiftId = body.data.id;
    });

    test('3.3 Employee transitions TaskOPad Work Order to IN_PROGRESS', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/v1/tasks/${createdTaskId}/transition`, {
        headers: {
          'Authorization': `Bearer ${workerToken}`,
          'x-tenant-id': tenantId,
        },
        data: {
          status: 'IN_PROGRESS',
        },
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('IN_PROGRESS');
    });

    test('3.4 Employee completes multi-step checklist items interactively', async ({ request }) => {
      // Toggle first 3 required items as completed
      for (let i = 0; i < 3; i++) {
        const itemId = checklistItemIds[i];
        if (!itemId) continue;

        const res = await request.patch(`${BASE_URL}/api/v1/tasks/${createdTaskId}/checklists/${itemId}`, {
          headers: {
            'Authorization': `Bearer ${workerToken}`,
            'x-tenant-id': tenantId,
          },
          data: {
            isCompleted: true,
          },
        });

        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.isCompleted).toBe(true);
      }
    });

    test('3.5 Employee executes Unolo GPS Check-In within geofence (12m distance)', async ({ request }) => {
      const checkinPayload = {
        latitude: 28.53565,
        longitude: 77.26815,
        accuracyMeters: 6.0,
        distanceMeters: 12.4,
        verificationResult: 'VALID',
        clientCapturedAt: new Date().toISOString(),
      };

      const res = await request.post(`${BASE_URL}/api/v1/visits/${createdVisitId}/checkin`, {
        headers: {
          'Authorization': `Bearer ${workerToken}`,
          'x-tenant-id': tenantId,
        },
        data: checkinPayload,
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.verificationResult).toBe('VALID');
      expect(body.data.distanceMeters).toBeLessThan(100);
    });

    test('3.6 Employee attaches Proof of Work: Geo-tagged Photo & Customer Signature', async ({ request }) => {
      // 1. Photo Proof
      const photoRes = await request.post(`${BASE_URL}/api/v1/visits/${createdVisitId}/proofs`, {
        headers: {
          'Authorization': `Bearer ${workerToken}`,
          'x-tenant-id': tenantId,
        },
        data: {
          proofType: 'PHOTO',
          storagePath: 'media/visits/ats_relay_test.jpg',
          fileName: 'ats_relay_test.jpg',
          notes: 'Thermal camera check shows normal 38°C busbar temperature.',
        },
      });
      expect(photoRes.ok()).toBeTruthy();
      const photoBody = await photoRes.json();
      expect(photoBody.data.proofType).toBe('PHOTO');

      // 2. Signature Proof
      const sigRes = await request.post(`${BASE_URL}/api/v1/visits/${createdVisitId}/proofs`, {
        headers: {
          'Authorization': `Bearer ${workerToken}`,
          'x-tenant-id': tenantId,
        },
        data: {
          proofType: 'SIGNATURE',
          storagePath: 'media/visits/client_signoff.png',
          signerName: 'Alok Verma (Facility Manager)',
          notes: 'Signed off on completed power failure simulation drill.',
        },
      });
      expect(sigRes.ok()).toBeTruthy();
      const sigBody = await sigRes.json();
      expect(sigBody.data.signerName).toBe('Alok Verma (Facility Manager)');
    });

    test('3.7 Employee checks out of field site with departure stamp', async ({ request }) => {
      const checkoutPayload = {
        latitude: 28.5356,
        longitude: 77.2681,
        accuracyMeters: 6.5,
        clientCapturedAt: new Date().toISOString(),
        notes: 'Inspection complete. ATS restored to automatic standby mode.',
      };

      const res = await request.post(`${BASE_URL}/api/v1/visits/${createdVisitId}/checkout`, {
        headers: {
          'Authorization': `Bearer ${workerToken}`,
          'x-tenant-id': tenantId,
        },
        data: checkoutPayload,
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.notes).toContain('ATS restored');
    });

    test('3.8 Employee marks TaskOPad Work Order COMPLETED', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/v1/tasks/${createdTaskId}/transition`, {
        headers: {
          'Authorization': `Bearer ${workerToken}`,
          'x-tenant-id': tenantId,
        },
        data: {
          status: 'COMPLETED',
        },
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('COMPLETED');
    });

    test('3.9 Employee clocks out of duty shift with departure GPS coordinates', async ({ request }) => {
      const clockOutPayload = {
        latitude: 28.5356,
        longitude: 77.2681,
        accuracyMeters: 7.0,
        notes: 'Duty shift ended. Generator ATS maintenance completed successfully.',
      };

      const res = await request.post(`${BASE_URL}/api/v1/attendance/clock-out`, {
        headers: {
          'Authorization': `Bearer ${workerToken}`,
          'x-tenant-id': tenantId,
        },
        data: clockOutPayload,
      });

      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('CLOCKED_OUT');
      expect(body.data.durationSeconds).toBeGreaterThanOrEqual(0);
    });
  });
});
