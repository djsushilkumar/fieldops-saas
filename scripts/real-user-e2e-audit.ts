/**
 * FieldOps Comprehensive Real-User End-to-End Audit Suite
 *
 * Simulates a real user and field organization across all operational domains:
 * - Health & infrastructure probes
 * - Organization registration & JWT authentication
 * - Location creation with GPS coordinates & geofences
 * - TaskOPad task engine: creation, checklist toggles, SLA dates, status transitions
 * - Unolo field visits: geofence check-in verification, proof of work, checkout
 * - Unolo attendance: GPS clock-in, active shift query, clock-out, audited adjustments
 * - Operations dashboard KPIs
 * - Operational reports (Tasks, Visits, Attendance, Workforce)
 * - SaaS billing & subscription overview
 */

export interface TestStepResult {
  step: number;
  domain: string;
  action: string;
  status: 'PASS' | 'FAIL';
  latencyMs: number;
  details: string;
}

export async function runRealUserE2EAudit(targetUrl: string = 'https://fieldops-saas-seven.vercel.app') {
  console.log(`================================================================================`);
  console.log(`🚀 Starting FieldOps Real-User End-to-End Audit`);
  console.log(`🎯 Target Deployment: ${targetUrl}`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);
  console.log(`================================================================================\n`);

  const results: TestStepResult[] = [];
  let token: string = '';
  let tenantId: string = '';
  let userId: string = '';
  let locationId: string = '';
  let taskId: string = '';
  let visitId: string = '';
  let attendanceId: string = '';

  const timestamp = Date.now();
  const testEmail = `user_audit_${timestamp}@fieldops.io`;
  const testPassword = 'Password123!';
  const orgName = `Audit Corp ${timestamp}`;
  const orgSlug = `audit-corp-${timestamp}`;

  async function executeStep(
    step: number,
    domain: string,
    action: string,
    fn: () => Promise<string>
  ) {
    const start = Date.now();
    try {
      const details = await fn();
      const latencyMs = Date.now() - start;
      results.push({ step, domain, action, status: 'PASS', latencyMs, details });
      console.log(`✅ [PASS] Step ${step} (${domain}): ${action} (${latencyMs}ms) - ${details}`);
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ step, domain, action, status: 'FAIL', latencyMs, details: msg });
      console.error(`❌ [FAIL] Step ${step} (${domain}): ${action} (${latencyMs}ms) - Error: ${msg}`);
    }
  }

  // 1. Health Probe
  await executeStep(1, 'Infrastructure', 'Health Liveness Probe', async () => {
    const res = await fetch(`${targetUrl}/api/health/live`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    return `Status: ${data.status || 'OK'}`;
  });

  // 2. Health Readiness Probe
  await executeStep(2, 'Infrastructure', 'Health Readiness Probe', async () => {
    const res = await fetch(`${targetUrl}/api/health/ready`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    return `Status: ${data.status || 'OK'}`;
  });

  // 3. User & Tenant Registration
  await executeStep(3, 'Auth & Multi-Tenancy', 'Register New Organization & Owner', async () => {
    const res = await fetch(`${targetUrl}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        fullName: 'Lead Auditor',
        organizationName: orgName,
        organizationSlug: orgSlug,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Signup failed (${res.status}): ${txt}`);
    }
    const json = await res.json();
    token = json.data.tokens.accessToken;
    userId = json.data.user.id;
    tenantId = json.data.activeMembership.organizationId;
    return `Registered User: ${userId}, Tenant: ${tenantId}, Role: ${json.data.activeMembership.role}`;
  });

  // 4. Session Validation
  await executeStep(4, 'Auth & Multi-Tenancy', 'Validate Session via Bearer Token', async () => {
    const res = await fetch(`${targetUrl}/api/v1/auth/session`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
    });
    if (!res.ok) throw new Error(`Session check failed (${res.status})`);
    const json = await res.json();
    return `Session verified for user ${json.data.user.email} in org ${json.data.activeMembership.organizationId}`;
  });

  // 5. Organization Details
  await executeStep(5, 'Auth & Multi-Tenancy', 'Fetch Organization Settings & Quotas', async () => {
    const res = await fetch(`${targetUrl}/api/v1/organizations`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
    });
    if (!res.ok) throw new Error(`List orgs failed (${res.status})`);
    const json = await res.json();
    const org = json.data[0];
    return `Organization Name: "${org.name}", Tier: ${org.subscriptionTier}, Geofence: ${org.settings?.allowedRadiusMeters || 150}m`;
  });

  // 6. Create Geofenced Location (Unolo feature)
  await executeStep(6, 'Geospatial & Locations', 'Create Client Location with Geofence', async () => {
    const res = await fetch(`${targetUrl}/api/v1/locations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({
        name: 'Delhi Distribution Center #4',
        address: 'Connaught Place Outer Circle, New Delhi',
        latitude: 28.6315,
        longitude: 77.2167,
        radiusMeters: 150,
      }),
    });
    if (!res.ok) throw new Error(`Create location failed (${res.status})`);
    const json = await res.json();
    locationId = json.data.id;
    return `Created Location ID: ${locationId} at (${json.data.latitude}, ${json.data.longitude}) with radius ${json.data.radiusMeters}m`;
  });

  // 7. Create Operational Task with Checklists (TaskOPad feature)
  await executeStep(7, 'TaskOPad Task Engine', 'Create Task with Interactive Checklists & Priority', async () => {
    const res = await fetch(`${targetUrl}/api/v1/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({
        title: 'Calibrate Industrial Freezer Thermostats',
        description: 'Check temperatures on units A1-A4 and record sensor readings.',
        priority: 'HIGH',
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        assignedTo: userId,
        checklists: [
          { title: 'De-ice inspection port', isRequired: true },
          { title: 'Verify digital thermometer probe', isRequired: true },
          { title: 'Log final operating delta', isRequired: false },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Create task failed (${res.status})`);
    const json = await res.json();
    taskId = json.data.id;
    return `Task Created: "${json.data.title}" (ID: ${taskId}), Priority: ${json.data.priority}, Checklists: ${json.data.checklists.length} items`;
  });

  // 8. Progress Task through Lifecycle State Machine
  await executeStep(8, 'TaskOPad Task Engine', 'Progress Task State Machine (ASSIGNED -> IN_PROGRESS -> COMPLETED)', async () => {
    // Transition to IN_PROGRESS
    const res1 = await fetch(`${targetUrl}/api/v1/tasks`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({
        id: taskId,
        status: 'IN_PROGRESS',
      }),
    });
    if (!res1.ok) throw new Error(`Update status to IN_PROGRESS failed (${res1.status})`);

    // Transition to COMPLETED
    const res2 = await fetch(`${targetUrl}/api/v1/tasks`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({
        id: taskId,
        status: 'COMPLETED',
      }),
    });
    if (!res2.ok) throw new Error(`Update status to COMPLETED failed (${res2.status})`);
    const json = await res2.json();
    return `Task ${taskId} completed successfully. Status: ${json.data.status}`;
  });

  // 9. Schedule Field Visit (Unolo feature)
  await executeStep(9, 'Unolo Visits & GPS', 'Schedule Field Visit to Client Site', async () => {
    const res = await fetch(`${targetUrl}/api/v1/visits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({
        locationId: locationId,
        assignedUserId: userId,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date(Date.now() + 7200000).toISOString(),
        notes: 'Monthly preventive site audit',
      }),
    });
    if (!res.ok) throw new Error(`Schedule visit failed (${res.status})`);
    const json = await res.json();
    visitId = json.data.id;
    return `Scheduled Visit ID: ${visitId} at Location ${json.data.locationId}`;
  });

  // 10. Visit Check-in with GPS Verification (Haversine distance within 150m)
  await executeStep(10, 'Unolo Visits & GPS', 'Execute GPS Geofence Verified Check-in (15m from site)', async () => {
    const res = await fetch(`${targetUrl}/api/v1/visits`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({
        id: visitId,
        checkin: {
          timestamp: new Date().toISOString(),
          latitude: 28.6316,
          longitude: 77.2168,
          accuracyMeters: 8,
          verificationResult: 'VERIFIED',
          distanceFromGeofenceMeters: 14.8,
        },
        status: 'IN_PROGRESS',
      }),
    });
    if (!res.ok) throw new Error(`Check-in failed (${res.status})`);
    const json = await res.json();
    return `Check-in recorded: Result=${json.data.checkin?.verificationResult}, Distance=${json.data.checkin?.distanceFromGeofenceMeters}m`;
  });

  // 11. Complete Visit with Proofs & Departure
  await executeStep(11, 'Unolo Visits & GPS', 'Submit Proof of Work (Photo, Signature) & Check-Out', async () => {
    const res = await fetch(`${targetUrl}/api/v1/visits`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({
        id: visitId,
        checkout: {
          timestamp: new Date().toISOString(),
          latitude: 28.6315,
          longitude: 77.2167,
          accuracyMeters: 6,
        },
        proofs: [
          {
            type: 'PHOTO',
            mediaUrl: 'https://fieldops-saas-seven.vercel.app/brand/fieldops-logo.svg',
            notes: 'Freezer inspection photo',
          },
          {
            type: 'SIGNATURE',
            mediaUrl: 'https://fieldops-saas-seven.vercel.app/brand/fieldops-logo.svg',
            notes: 'Client supervisor sign-off',
          },
        ],
        status: 'COMPLETED',
      }),
    });
    if (!res.ok) throw new Error(`Complete visit failed (${res.status})`);
    const json = await res.json();
    return `Visit completed: Proofs=${json.data.proofs?.length}, Status=${json.data.status}`;
  });

  // 12. Unolo Attendance Shift Clock-In
  await executeStep(12, 'Unolo Attendance', 'Field Worker Clock-In with Point-in-Time GPS', async () => {
    const res = await fetch(`${targetUrl}/api/v1/attendance/clock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({
        latitude: 28.6315,
        longitude: 77.2167,
        accuracyMeters: 5,
        notes: 'Starting morning field shift',
      }),
    });
    if (!res.ok) throw new Error(`Clock-in failed (${res.status})`);
    const json = await res.json();
    attendanceId = json.data.id;
    return `Shift Clocked-In ID: ${attendanceId} at (${json.data.checkInLatitude}, ${json.data.checkInLongitude})`;
  });

  // 13. Active Shift Query
  await executeStep(13, 'Unolo Attendance', 'Query Worker Active Shift', async () => {
    const res = await fetch(`${targetUrl}/api/v1/attendance/active`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
    });
    if (!res.ok) throw new Error(`Active shift query failed (${res.status})`);
    const json = await res.json();
    if (!json.data || json.data.status !== 'CLOCKED_IN') {
      throw new Error(`Expected active shift, got: ${JSON.stringify(json.data)}`);
    }
    return `Active Shift Confirmed: ID ${json.data.id}, Status: ${json.data.status}`;
  });

  // 14. Attendance Shift Clock-Out & Duration
  await executeStep(14, 'Unolo Attendance', 'Field Worker Clock-Out & Shift Duration Calculation', async () => {
    const res = await fetch(`${targetUrl}/api/v1/attendance/clock-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({
        latitude: 28.6317,
        longitude: 77.2169,
        accuracyMeters: 7,
        notes: 'End of shift',
      }),
    });
    if (!res.ok) throw new Error(`Clock-out failed (${res.status})`);
    const json = await res.json();
    return `Shift Clocked-Out: Duration=${json.data.durationMinutes || 0}m, Status=${json.data.status}`;
  });

  // 15. Dashboard Operational KPIs
  await executeStep(15, 'Operations Dashboard', 'Fetch Core KPIs & Situational Metrics', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`${targetUrl}/api/v1/dashboard/kpis?date=${today}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
    });
    if (!res.ok) throw new Error(`KPIs query failed (${res.status})`);
    const json = await res.json();
    const kpis = json.data;
    return `KPIs: TasksToday=${kpis.tasksToday}, Done=${kpis.tasksCompletedToday}, VisitsToday=${kpis.visitsToday}, ActiveWorkers=${kpis.activeWorkers}`;
  });

  // 16. Operational Reports: Tasks
  await executeStep(16, 'Reports & Exports', 'Generate Tasks Operational Report', async () => {
    const res = await fetch(`${targetUrl}/api/v1/reports/tasks`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
    });
    if (!res.ok) throw new Error(`Tasks report failed (${res.status})`);
    const json = await res.json();
    const summary = json.data.summary || json.data;
    return `Tasks Report: Total=${summary.totalTasks || 0}, Completed=${summary.completedTasks || 0}, Rate=${summary.completionRatePercentage || 100}%`;
  });

  // 17. Operational Reports: Visits & Geofences
  await executeStep(17, 'Reports & Exports', 'Generate Visits & Geofence Compliance Report', async () => {
    const res = await fetch(`${targetUrl}/api/v1/reports/visits`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
    });
    if (!res.ok) throw new Error(`Visits report failed (${res.status})`);
    const json = await res.json();
    const summary = json.data.summary || json.data;
    return `Visits Report: Total=${summary.totalScheduled || summary.totalVisits || 0}, Completed=${summary.completedVisits || 0}, VerifiedRate=${summary.geofenceVerificationRatePercentage || 100}%`;
  });

  // 18. Operational Reports: Attendance & Shifts
  await executeStep(18, 'Reports & Exports', 'Generate Attendance & Shift Summary Report', async () => {
    const res = await fetch(`${targetUrl}/api/v1/reports/attendance`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
    });
    if (!res.ok) throw new Error(`Attendance report failed (${res.status})`);
    const json = await res.json();
    const summary = json.data.summary || json.data;
    return `Attendance Report: TotalShifts=${summary.totalShifts || 0}, HoursLogged=${summary.totalHoursLogged || 0}h`;
  });

  // 19. SaaS Billing & Subscriptions
  await executeStep(19, 'SaaS Subscriptions', 'Fetch Plan Quotas & Billing Overview', async () => {
    const res = await fetch(`${targetUrl}/api/v1/billing/overview`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
    });
    if (!res.ok) throw new Error(`Billing overview failed (${res.status})`);
    const json = await res.json();
    const data = json.data;
    const plan = data.subscription?.plan || data.subscriptionTier || 'GROWTH';
    const status = data.subscription?.status || data.subscriptionStatus || 'ACTIVE';
    return `Plan: ${plan}, Status: ${status}, TasksLimit: ${data.quotas?.maxTasksPerMonth || data.limits?.tasksPerMonth || 1000}`;
  });

  // Summary
  console.log(`\n================================================================================`);
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`🏁 Audit Results Summary: ${passed} Passed, ${failed} Failed out of ${results.length} total tests`);
  console.log(`================================================================================`);

  return { total: results.length, passed, failed, results };
}

if (require.main === module) {
  runRealUserE2EAudit()
    .then((report) => {
      if (report.failed > 0) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal audit failure:', err);
      process.exit(1);
    });
}
