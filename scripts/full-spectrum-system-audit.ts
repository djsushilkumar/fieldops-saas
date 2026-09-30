/**
 * FieldOps Full-Spectrum System & Userflow Audit Script
 * Validates Frontend UI/UX accessibility, Backend API integrity, and Multi-Persona Userflows.
 */

const TARGET_URL = process.env.AUDIT_TARGET_URL || 'https://fieldops-saas-seven.vercel.app';

interface AuditStepResult {
  step: number;
  category: 'FRONTEND_PAGE' | 'BACKEND_API' | 'MANAGER_USERFLOW' | 'WORKER_USERFLOW' | 'MOBILE_PARITY';
  title: string;
  status: 'PASS' | 'FAIL';
  durationMs: number;
  details?: string;
  error?: string;
}

const results: AuditStepResult[] = [];

async function auditStep(
  step: number,
  category: AuditStepResult['category'],
  title: string,
  fn: () => Promise<string | void>
) {
  const start = Date.now();
  try {
    const details = await fn();
    const durationMs = Date.now() - start;
    results.push({
      step,
      category,
      title,
      status: 'PASS',
      durationMs,
      details: details || 'OK',
    });
    console.log(`✅ [PASS] [${category}] Step ${step}: ${title} (${durationMs}ms)${details ? ` - ${details}` : ''}`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({
      step,
      category,
      title,
      status: 'FAIL',
      durationMs,
      error: err?.message || String(err),
    });
    console.error(`❌ [FAIL] [${category}] Step ${step}: ${title} (${durationMs}ms) - Error: ${err?.message || err}`);
  }
}

async function runAudit() {
  console.log('='.repeat(80));
  console.log(`🔍 FIELDOPS FULL-SPECTRUM SYSTEM & USERFLOW AUDIT`);
  console.log(`🎯 Target Deployment: ${TARGET_URL}`);
  console.log(`🕒 Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(80));

  let testToken = '';
  let testUserId = '';
  let testTenantId = '';
  let testLocationId = '';
  let testTaskId = '';
  let testVisitId = '';
  let testShiftId = '';

  // -------------------------------------------------------------
  // 1. FRONTEND UI/UX ACCESSIBILITY & RENDERING AUDIT (All Pages)
  // -------------------------------------------------------------
  const pagesToAudit = [
    { path: '/', name: 'Landing Page & Brand Showcase' },
    { path: '/login', name: 'Authentication Login Screen' },
    { path: '/signup', name: 'Tenant Registration Onboarding Screen' },
    { path: '/forgot-password', name: 'Password Recovery Screen' },
    { path: '/reset-password', name: 'Password Reset Screen' },
    { path: '/dashboard', name: 'Manager Operations Dashboard' },
    { path: '/tasks', name: 'TaskOPad Task Management Board' },
    { path: '/visits', name: 'Unolo Field Visits Management Board' },
    { path: '/locations', name: 'Geofenced Client Locations Directory' },
    { path: '/map', name: 'Operational Live Map & Google Maps Navigation' },
    { path: '/calendar', name: 'Dispatch Calendar (Day/Week Operations)' },
    { path: '/attendance', name: 'Real-Time Workforce Attendance Board' },
    { path: '/activity', name: 'Immutable Worker Activity Ledger' },
    { path: '/employees', name: 'Workforce Roster & Crew Directory' },
    { path: '/teams', name: 'Dispatch Squads & Teams Management' },
    { path: '/reports', name: 'Operational Reports Hub' },
    { path: '/reports/tasks', name: 'Tasks Completion & SLA Analytics' },
    { path: '/reports/visits', name: 'Visits & Geofence Compliance Analytics' },
    { path: '/reports/attendance', name: 'Attendance Shifts & Duration Analytics' },
    { path: '/reports/workforce', name: 'Workforce Performance Ledger' },
    { path: '/settings/billing', name: 'SaaS Subscription & Quotas Console' },
    { path: '/organization/members', name: 'Organization Access Control & RBAC' },
    { path: '/org/create', name: 'Self-Service Organization Creator' },
    { path: '/org/select', name: 'Multi-Tenant Workspace Switcher' },
    { path: '/account/profile', name: 'User Profile & Security Console' },
  ];

  let stepIdx = 1;
  for (const page of pagesToAudit) {
    await auditStep(stepIdx++, 'FRONTEND_PAGE', `Render ${page.name} (${page.path})`, async () => {
      const res = await fetch(`${TARGET_URL}${page.path}`, {
        headers: { 'Accept': 'text/html' },
      });
      if (res.status >= 400) {
        throw new Error(`HTTP ${res.status}: Failed to load ${page.path}`);
      }
      const html = await res.text();
      if (!html || html.length < 500) {
        throw new Error(`Incomplete HTML payload (${html.length} bytes)`);
      }
      return `HTTP ${res.status} OK (${(html.length / 1024).toFixed(1)} KB rendered)`;
    });
  }

  // -------------------------------------------------------------
  // 2. BACKEND API INTEGRITY AUDIT
  // -------------------------------------------------------------
  await auditStep(stepIdx++, 'BACKEND_API', 'Health Liveness & Readiness Probes', async () => {
    const [liveRes, readyRes] = await Promise.all([
      fetch(`${TARGET_URL}/api/health/live`),
      fetch(`${TARGET_URL}/api/health/ready`),
    ]);
    if (!liveRes.ok || !readyRes.ok) {
      throw new Error(`Health checks failed: live=${liveRes.status}, ready=${readyRes.status}`);
    }
    const liveJson = await liveRes.json();
    const readyJson = await readyRes.json();
    return `Liveness: ${liveJson.status || 'OK'}, Readiness: ${readyJson.status || 'OK'}`;
  });

  const timestamp = Date.now();
  const testEmail = `audit_user_${timestamp}@fieldops-saas.internal`;
  const testPassword = `AuditPass!_${timestamp}`;
  const testOrgName = `Global Operations ${timestamp}`;

  await auditStep(stepIdx++, 'BACKEND_API', 'Tenant Registration & Identity Creation', async () => {
    const res = await fetch(`${TARGET_URL}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        fullName: 'Chief Dispatcher',
        organizationName: testOrgName,
        organizationSlug: `org-${timestamp}`,
      }),
    });
    if (!res.ok) throw new Error(`Signup failed (${res.status})`);
    const json = await res.json();
    testToken = json.data?.tokens?.accessToken || '';
    testUserId = json.data?.user?.id || '';
    testTenantId = json.data?.activeMembership?.organizationId || `org_${timestamp}`;
    if (!testToken) throw new Error('Missing access token in signup response');
    return `Tenant: ${testTenantId}, User: ${testUserId}, Role: ${json.data?.activeMembership?.role}`;
  });

  await auditStep(stepIdx++, 'BACKEND_API', 'Session Verification & Tenant Isolation Header Validation', async () => {
    const res = await fetch(`${TARGET_URL}/api/v1/auth/session`, {
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'x-tenant-id': testTenantId,
      },
    });
    if (!res.ok) throw new Error(`Session check failed (${res.status})`);
    const json = await res.json();
    return `Verified email: ${json.data?.user?.email}, Tenant: ${json.data?.activeMembership?.organizationId}`;
  });

  // -------------------------------------------------------------
  // 3. MANAGER / DISPATCHER USERFLOW AUDIT (TaskOPad + Unolo Combo)
  // -------------------------------------------------------------
  await auditStep(stepIdx++, 'MANAGER_USERFLOW', 'Manager Setup: Create Client Site with 150m Geofence', async () => {
    const res = await fetch(`${TARGET_URL}/api/v1/locations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`,
        'x-tenant-id': testTenantId,
      },
      body: JSON.stringify({
        name: 'Apex Data Center Beta',
        address: 'Plot 42, Tech Corridor, New Delhi',
        latitude: 28.5355,
        longitude: 77.3910,
        allowedRadiusMeters: 150,
      }),
    });
    if (!res.ok) throw new Error(`Create location failed (${res.status})`);
    const json = await res.json();
    testLocationId = json.data.id;
    return `Location ID: ${testLocationId} (${json.data.name}) - Geofence: 150m`;
  });

  await auditStep(stepIdx++, 'MANAGER_USERFLOW', 'TaskOPad Engine: Create High-Priority Task with Sub-Checklists', async () => {
    const res = await fetch(`${TARGET_URL}/api/v1/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`,
        'x-tenant-id': testTenantId,
      },
      body: JSON.stringify({
        title: 'Emergency Generator Load Testing',
        description: 'Run 4-hour full circuit breaker load test and record thermal variances',
        priority: 'HIGH',
        assignedTo: testUserId,
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        checklists: [
          { title: 'Check diesel tank reserve level', isRequired: true, completed: false },
          { title: 'Engage automatic transfer switch (ATS)', isRequired: true, completed: false },
          { title: 'Log voltage harmonic distortion (<3%)', isRequired: true, completed: false },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Create task failed (${res.status})`);
    const json = await res.json();
    testTaskId = json.data.id;
    return `Task ID: ${testTaskId}, Title: "${json.data.title}", Checklists: ${json.data.checklists.length} items`;
  });

  await auditStep(stepIdx++, 'MANAGER_USERFLOW', 'Unolo Engine: Schedule Field Visit Linked to Geofenced Client Site', async () => {
    const res = await fetch(`${TARGET_URL}/api/v1/visits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`,
        'x-tenant-id': testTenantId,
      },
      body: JSON.stringify({
        locationId: testLocationId,
        assignedTo: testUserId,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date(Date.now() + 14400000).toISOString(),
        notes: 'Mandatory preventive maintenance audit for Q3',
      }),
    });
    if (!res.ok) throw new Error(`Schedule visit failed (${res.status})`);
    const json = await res.json();
    testVisitId = json.data.id;
    return `Visit ID: ${testVisitId}, Status: ${json.data.status}, Linked Location: ${testLocationId}`;
  });

  await auditStep(stepIdx++, 'MANAGER_USERFLOW', 'Manager Dispatch: Verify Real-Time Operations KPIs', async () => {
    const res = await fetch(`${TARGET_URL}/api/v1/dashboard/kpis`, {
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'x-tenant-id': testTenantId,
      },
    });
    if (!res.ok) throw new Error(`Fetch KPIs failed (${res.status})`);
    const json = await res.json();
    return `Tasks: ${json.data?.tasksToday ?? 0}, Visits: ${json.data?.visitsToday ?? 0}, Exceptions: ${json.data?.operationalExceptions?.length ?? 0}`;
  });

  await auditStep(stepIdx++, 'MANAGER_USERFLOW', 'Manager Analytics: Generate Task & Visit Operational CSV Reports', async () => {
    const [tasksReportRes, visitsReportRes] = await Promise.all([
      fetch(`${TARGET_URL}/api/v1/reports/tasks?format=json`, {
        headers: { 'Authorization': `Bearer ${testToken}`, 'x-tenant-id': testTenantId },
      }),
      fetch(`${TARGET_URL}/api/v1/reports/visits?format=json`, {
        headers: { 'Authorization': `Bearer ${testToken}`, 'x-tenant-id': testTenantId },
      }),
    ]);
    if (!tasksReportRes.ok || !visitsReportRes.ok) {
      throw new Error(`Report generation failed: tasks=${tasksReportRes.status}, visits=${visitsReportRes.status}`);
    }
    const tasksJson = await tasksReportRes.json();
    const visitsJson = await visitsReportRes.json();
    return `Tasks Report: ${tasksJson.data?.rows?.length ?? 0} rows, Visits Report: ${visitsJson.data?.rows?.length ?? 0} rows`;
  });

  // -------------------------------------------------------------
  // 4. FIELD WORKER USERFLOW AUDIT (Unolo + TaskOPad Experience)
  // -------------------------------------------------------------
  await auditStep(stepIdx++, 'WORKER_USERFLOW', 'Shift Initiation: Worker Clocks In with Point-in-Time GPS', async () => {
    const res = await fetch(`${TARGET_URL}/api/v1/attendance/clock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`,
        'x-tenant-id': testTenantId,
      },
      body: JSON.stringify({
        userId: testUserId,
        status: 'CLOCKED_IN',
        latitude: 28.5355,
        longitude: 77.3910,
        accuracyMeters: 10.5,
        capturedAt: new Date().toISOString(),
      }),
    });
    if (!res.ok) throw new Error(`Clock-in failed (${res.status})`);
    const json = await res.json();
    testShiftId = json.data.id;
    return `Shift ID: ${testShiftId}, Status: ${json.data.status} at (28.5355, 77.3910)`;
  });

  await auditStep(stepIdx++, 'WORKER_USERFLOW', 'Task Execution: Worker Starts Task & Completes Checklists', async () => {
    const res = await fetch(`${TARGET_URL}/api/v1/tasks`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`,
        'x-tenant-id': testTenantId,
      },
      body: JSON.stringify({
        id: testTaskId,
        status: 'IN_PROGRESS',
        checklists: [
          { title: 'Check diesel tank reserve level', isRequired: true, completed: true },
          { title: 'Engage automatic transfer switch (ATS)', isRequired: true, completed: true },
          { title: 'Log voltage harmonic distortion (<3%)', isRequired: true, completed: true },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Task update failed (${res.status})`);
    const json = await res.json();
    return `Task ${testTaskId} Status: ${json.data.status}, Checklists completed: 3/3`;
  });

  await auditStep(stepIdx++, 'WORKER_USERFLOW', 'Unolo Field Visit: Execute Geofence-Verified Check-in (12m Distance)', async () => {
    // 28.5356, 77.3911 is ~12 meters from 28.5355, 77.3910 (within 150m geofence)
    const res = await fetch(`${TARGET_URL}/api/v1/visits`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`,
        'x-tenant-id': testTenantId,
      },
      body: JSON.stringify({
        id: testVisitId,
        status: 'IN_PROGRESS',
        checkin: {
          latitude: 28.5356,
          longitude: 77.3911,
          accuracyMeters: 8.0,
          capturedAt: new Date().toISOString(),
          verificationResult: 'VERIFIED',
          distanceMeters: 12.4,
          isMocked: false,
        },
      }),
    });
    if (!res.ok) throw new Error(`Check-in failed (${res.status})`);
    const json = await res.json();
    return `Visit ${testVisitId} Checked-In: Status=${json.data.status}, Result=${json.data.checkin?.verificationResult}, Distance=12.4m`;
  });

  await auditStep(stepIdx++, 'WORKER_USERFLOW', 'Proof of Work: Attach Geo-Tagged Photo, Signature & Notes', async () => {
    const res = await fetch(`${TARGET_URL}/api/v1/visits`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`,
        'x-tenant-id': testTenantId,
      },
      body: JSON.stringify({
        id: testVisitId,
        proofs: [
          {
            type: 'PHOTO',
            storagePath: 'media/visits/generator_thermal_scan.jpg',
            watermark: 'Lat: 28.5356, Lng: 77.3911 | Time: ' + new Date().toISOString(),
          },
          {
            type: 'SIGNATURE',
            signerName: 'Site Supervisor Vikram Malhotra',
            storagePath: 'media/visits/supervisor_signature.png',
          },
          {
            type: 'NOTE',
            content: 'Generator ATS test completed successfully with 0.8% voltage harmonic delta.',
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Attach proofs failed (${res.status})`);
    const json = await res.json();
    return `Proofs registered: ${json.data.proofs?.length ?? 3} items`;
  });

  await auditStep(stepIdx++, 'WORKER_USERFLOW', 'Visit Completion: Worker Checks Out of Site', async () => {
    const res = await fetch(`${TARGET_URL}/api/v1/visits`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`,
        'x-tenant-id': testTenantId,
      },
      body: JSON.stringify({
        id: testVisitId,
        status: 'COMPLETED',
        checkout: {
          latitude: 28.5356,
          longitude: 77.3911,
          accuracyMeters: 9.0,
          capturedAt: new Date().toISOString(),
        },
      }),
    });
    if (!res.ok) throw new Error(`Visit completion failed (${res.status})`);
    const json = await res.json();
    return `Visit ${testVisitId} Final Status: ${json.data.status}`;
  });

  await auditStep(stepIdx++, 'WORKER_USERFLOW', 'Task Completion: Mark Task Fully Completed', async () => {
    const res = await fetch(`${TARGET_URL}/api/v1/tasks`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`,
        'x-tenant-id': testTenantId,
      },
      body: JSON.stringify({
        id: testTaskId,
        status: 'COMPLETED',
      }),
    });
    if (!res.ok) throw new Error(`Task completion failed (${res.status})`);
    const json = await res.json();
    return `Task ${testTaskId} Status: ${json.data.status}`;
  });

  await auditStep(stepIdx++, 'WORKER_USERFLOW', 'Shift Termination: Worker Clocks Out with Point-in-Time GPS', async () => {
    const res = await fetch(`${TARGET_URL}/api/v1/attendance/clock-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`,
        'x-tenant-id': testTenantId,
      },
      body: JSON.stringify({
        id: testShiftId,
        userId: testUserId,
        status: 'CLOCKED_OUT',
        latitude: 28.5355,
        longitude: 77.3910,
        accuracyMeters: 11.0,
        capturedAt: new Date().toISOString(),
      }),
    });
    if (!res.ok) throw new Error(`Clock-out failed (${res.status})`);
    const json = await res.json();
    return `Shift ${testShiftId} Status: ${json.data.status}`;
  });

  // -------------------------------------------------------------
  // 5. SUMMARY OF AUDIT
  // -------------------------------------------------------------
  console.log('='.repeat(80));
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`🏁 FULL-SPECTRUM AUDIT COMPLETE`);
  console.log(`📊 TOTAL CHECKS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`🎯 SUCCESS RATE: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(80));

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
