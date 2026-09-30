import {
  AuthSession,
  UserProfile,
  Membership,
  Organization,
  UserRole,
  MembershipStatus,
  TenantId,
  UserId,
  UUID,
  IsoDateTime,
} from '@fieldops/types';

interface MemoryDb {
  users: Map<string, UserProfile>;
  passwords: Map<string, string>;
  organizations: Map<string, Organization>;
  memberships: Map<string, Membership[]>;
  tasks: Map<string, any[]>;
  locations: Map<string, any[]>;
  visits: Map<string, any[]>;
  attendance: Map<string, any[]>;
}

const g = globalThis as unknown as { __fieldops_db?: MemoryDb };
if (!g.__fieldops_db) {
  g.__fieldops_db = {
    users: new Map(),
    passwords: new Map(),
    organizations: new Map(),
    memberships: new Map(),
    tasks: new Map(),
    locations: new Map(),
    visits: new Map(),
    attendance: new Map(),
  };
}

export const memoryDb = g.__fieldops_db;

export function createSessionResponse(
  user: UserProfile,
  org: Organization,
  role: UserRole = UserRole.OWNER
): AuthSession {
  const membershipId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` as UUID;
  const membership: Membership = {
    id: membershipId,
    organizationId: org.id,
    userId: user.id,
    role,
    status: MembershipStatus.ACTIVE,
    createdAt: new Date().toISOString() as IsoDateTime,
    updatedAt: new Date().toISOString() as IsoDateTime,
    organization: org,
    user,
  };

  const userMemberships = memoryDb.memberships.get(user.id) || [];
  if (!userMemberships.some((m) => m.organizationId === org.id)) {
    userMemberships.push(membership);
    memoryDb.memberships.set(user.id, userMemberships);
  }

  const tokenPayload = {
    sub: user.id,
    email: user.email,
    tenant_id: org.id,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 7,
  };
  const tokenStr = `fo_jwt_${Buffer.from(JSON.stringify(tokenPayload)).toString('base64url')}`;

  return {
    user,
    tokens: {
      accessToken: tokenStr,
      refreshToken: `fo_ref_${Math.random().toString(36).substring(2)}`,
      expiresIn: 604800,
      tokenType: 'Bearer',
    },
    activeMembership: membership,
    availableMemberships: userMemberships,
  };
}

export async function syncWithSupabaseAuth(
  endpoint: string,
  body: Record<string, unknown>
): Promise<any | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey || supabaseUrl.includes('placeholder') || supabaseUrl.includes('127.0.0.1')) {
    return null;
  }

  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[Supabase Auth Sync Warning]:', err);
  }

  return null;
}

export function ensureTenantSeeded(tenantId: string) {
  if (!memoryDb.locations.has(tenantId) || (memoryDb.locations.get(tenantId)?.length ?? 0) === 0) {
    const loc1 = {
      id: 'loc_delhi_01',
      organizationId: tenantId,
      name: 'Apex Data Center Alpha',
      address: 'Plot 18, Okhla Industrial Area Phase III, New Delhi',
      latitude: 28.5355,
      longitude: 77.2680,
      allowedRadiusMeters: 100,
      status: 'ACTIVE',
      createdBy: 'usr_owner',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const loc2 = {
      id: 'loc_mumbai_02',
      organizationId: tenantId,
      name: 'Metro Logistics Cold Storage',
      address: 'Sector 19C, Vashi Navi Mumbai, Maharashtra',
      latitude: 19.0760,
      longitude: 72.8777,
      allowedRadiusMeters: 150,
      status: 'ACTIVE',
      createdBy: 'usr_owner',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const loc3 = {
      id: 'loc_bengaluru_03',
      organizationId: tenantId,
      name: 'CyberTech Innovation Hub',
      address: 'Electronic City Phase 1, Bengaluru, Karnataka',
      latitude: 12.8452,
      longitude: 77.6602,
      allowedRadiusMeters: 120,
      status: 'ACTIVE',
      createdBy: 'usr_owner',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const loc4 = {
      id: 'loc_noida_04',
      organizationId: tenantId,
      name: 'Reliance Retail Distribution Hub',
      address: 'Block B, Sector 63, Noida, Uttar Pradesh',
      latitude: 28.6258,
      longitude: 77.3789,
      allowedRadiusMeters: 80,
      status: 'ACTIVE',
      createdBy: 'usr_owner',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryDb.locations.set(tenantId, [loc1, loc2, loc3, loc4]);
  }

  if (!memoryDb.tasks.has(tenantId) || (memoryDb.tasks.get(tenantId)?.length ?? 0) === 0) {
    const now = new Date();
    const t1 = {
      id: 'tsk_001_hvac',
      organizationId: tenantId,
      title: 'HVAC Air Handler #2 Motor Lubrication & Freon Test',
      description: 'Access rooftop condenser unit at Apex Data Center, inspect bearings, and apply high-temp synthetic grease.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      locationId: 'loc_delhi_01',
      locationName: 'Apex Data Center Alpha',
      assignedTo: 'usr_tech_rajesh',
      assignedToName: 'Rajesh Kumar (Field Tech)',
      dueAt: new Date(now.getTime() + 4 * 3600000).toISOString(),
      version: 2,
      createdAt: new Date(now.getTime() - 24 * 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
      checklists: [
        { id: 'chk_1', title: 'Lockout / Tagout power disconnect switch', isRequired: true, completed: true, isCompleted: true },
        { id: 'chk_2', title: 'Inspect fan belt tension and alignment', isRequired: true, completed: true, isCompleted: true },
        { id: 'chk_3', title: 'Inject high-pressure synthetic bearing lubricant', isRequired: true, completed: false, isCompleted: false },
        { id: 'chk_4', title: 'Capture thermal camera photo of compressor head', isRequired: false, completed: false, isCompleted: false },
      ],
    };
    const t2 = {
      id: 'tsk_002_generator',
      organizationId: tenantId,
      title: 'Emergency Generator ATS Switch & Load Transfer Test',
      description: 'Conduct simulated power failure drill and verify automatic transfer switch engages within 10 seconds.',
      priority: 'URGENT',
      status: 'ASSIGNED',
      locationId: 'loc_delhi_01',
      locationName: 'Apex Data Center Alpha',
      assignedTo: 'usr_tech_amit',
      assignedToName: 'Amit Verma (Power Systems)',
      dueAt: new Date(now.getTime() + 2 * 3600000).toISOString(),
      version: 1,
      createdAt: new Date(now.getTime() - 12 * 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
      checklists: [
        { id: 'chk_2_1', title: 'Verify diesel fuel reserve level (>85%)', isRequired: true, completed: false, isCompleted: false },
        { id: 'chk_2_2', title: 'Inspect 24V starter battery float voltage', isRequired: true, completed: false, isCompleted: false },
        { id: 'chk_2_3', title: 'Test emergency cut-off solenoid response', isRequired: true, completed: false, isCompleted: false },
      ],
    };
    const t3 = {
      id: 'tsk_003_solar',
      organizationId: tenantId,
      title: 'Rooftop Solar Array Inverter Telemetry Calibration',
      description: 'Calibrate MPPT charge controllers and verify string voltage outputs match SCADA dashboard.',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      locationId: 'loc_bengaluru_03',
      locationName: 'CyberTech Innovation Hub',
      assignedTo: 'usr_tech_priya',
      assignedToName: 'Priya Sharma (Solar Specialist)',
      dueAt: new Date(now.getTime() + 8 * 3600000).toISOString(),
      version: 1,
      createdAt: new Date(now.getTime() - 8 * 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
      checklists: [
        { id: 'chk_3_1', title: 'Measure string DC open-circuit voltage', isRequired: true, completed: true, isCompleted: true },
        { id: 'chk_3_2', title: 'Clean dust off irradiance pyranometer sensor', isRequired: true, completed: true, isCompleted: true },
        { id: 'chk_3_3', title: 'Flash inverter control firmware update v2.4', isRequired: false, completed: false, isCompleted: false },
      ],
    };
    const t4 = {
      id: 'tsk_004_coldchain',
      organizationId: tenantId,
      title: 'Industrial Cold Storage Ammonia Leak & Chiller Audit',
      description: 'Audit primary suction valves and verify cold-chain temperature maintains between -18°C and -22°C.',
      priority: 'HIGH',
      status: 'COMPLETED',
      locationId: 'loc_mumbai_02',
      locationName: 'Metro Logistics Cold Storage',
      assignedTo: 'usr_tech_vikram',
      assignedToName: 'Vikram Malhotra (Senior Engineer)',
      dueAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
      version: 3,
      createdAt: new Date(now.getTime() - 36 * 3600000).toISOString(),
      updatedAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
      checklists: [
        { id: 'chk_4_1', title: 'Calibrate digital temperature loggers', isRequired: true, completed: true, isCompleted: true },
        { id: 'chk_4_2', title: 'Check ammonia vapor detector sensors', isRequired: true, completed: true, isCompleted: true },
        { id: 'chk_4_3', title: 'Obtain warehouse supervisor sign-off', isRequired: true, completed: true, isCompleted: true },
      ],
    };
    const t5 = {
      id: 'tsk_005_cctv',
      organizationId: tenantId,
      title: 'Perimeter Security Camera & Optical Sensor Inspection',
      description: 'Align perimeter PTZ cameras and verify night vision infrared illumination range at distribution gate.',
      priority: 'LOW',
      status: 'ASSIGNED',
      locationId: 'loc_noida_04',
      locationName: 'Reliance Retail Distribution Hub',
      assignedTo: 'usr_tech_rajesh',
      assignedToName: 'Rajesh Kumar (Field Tech)',
      dueAt: new Date(now.getTime() + 18 * 3600000).toISOString(),
      version: 1,
      createdAt: new Date(now.getTime() - 4 * 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
      checklists: [
        { id: 'chk_5_1', title: 'Clean PTZ dome glass with anti-static solution', isRequired: true, completed: false, isCompleted: false },
        { id: 'chk_5_2', title: 'Test NVR motion alert push triggers', isRequired: true, completed: false, isCompleted: false },
      ],
    };
    memoryDb.tasks.set(tenantId, [t1, t2, t3, t4, t5]);
  }

  if (!memoryDb.visits.has(tenantId) || (memoryDb.visits.get(tenantId)?.length ?? 0) === 0) {
    const now = new Date();
    const locations = memoryDb.locations.get(tenantId) || [];
    const loc1 = locations[0];
    const loc2 = locations[1];
    const loc3 = locations[2];

    const v1 = {
      id: 'vis_001_delhi',
      organizationId: tenantId,
      locationId: loc1?.id || 'loc_delhi_01',
      location: loc1,
      assignedTo: 'usr_tech_rajesh',
      assigneeName: 'Rajesh Kumar',
      status: 'IN_PROGRESS',
      scheduledStart: new Date(now.getTime() - 3600000).toISOString(),
      scheduledEnd: new Date(now.getTime() + 7200000).toISOString(),
      checkin: {
        latitude: 28.5356,
        longitude: 77.2681,
        accuracyMeters: 8.5,
        capturedAt: new Date(now.getTime() - 1800000).toISOString(),
        verificationResult: 'VERIFIED',
        distanceMeters: 14.2,
      },
      proofs: [
        { type: 'PHOTO', storagePath: 'media/visits/delhi_hvac_photo.jpg', watermark: 'Lat: 28.5356, Lng: 77.2681' },
      ],
      notes: 'Currently on-site inspecting air handler motor unit #2.',
      version: 2,
      createdAt: new Date(now.getTime() - 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const v2 = {
      id: 'vis_002_mumbai',
      organizationId: tenantId,
      locationId: loc2?.id || 'loc_mumbai_02',
      location: loc2,
      assignedTo: 'usr_tech_vikram',
      assigneeName: 'Vikram Malhotra',
      status: 'COMPLETED',
      scheduledStart: new Date(now.getTime() - 5 * 3600000).toISOString(),
      scheduledEnd: new Date(now.getTime() - 2 * 3600000).toISOString(),
      checkin: {
        latitude: 19.0761,
        longitude: 72.8778,
        accuracyMeters: 6.0,
        capturedAt: new Date(now.getTime() - 4 * 3600000).toISOString(),
        verificationResult: 'VERIFIED',
        distanceMeters: 18.5,
      },
      checkout: {
        latitude: 19.0761,
        longitude: 72.8778,
        accuracyMeters: 6.5,
        capturedAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
      },
      proofs: [
        { type: 'PHOTO', storagePath: 'media/visits/chiller_log.jpg', watermark: 'Lat: 19.0761, Lng: 72.8778' },
        { type: 'SIGNATURE', signerName: 'Warehouse Lead Anil Deshmukh', storagePath: 'media/visits/deshmukh_sig.png' },
      ],
      notes: 'Completed cold storage ammonia leak test and sensor calibration.',
      version: 3,
      createdAt: new Date(now.getTime() - 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const v3 = {
      id: 'vis_003_bengaluru',
      organizationId: tenantId,
      locationId: loc3?.id || 'loc_bengaluru_03',
      location: loc3,
      assignedTo: 'usr_tech_priya',
      assigneeName: 'Priya Sharma',
      status: 'SCHEDULED',
      scheduledStart: new Date(now.getTime() + 2 * 3600000).toISOString(),
      scheduledEnd: new Date(now.getTime() + 6 * 3600000).toISOString(),
      notes: 'Scheduled solar array telemetry scan.',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    memoryDb.visits.set(tenantId, [v1, v2, v3]);
  }

  if (!memoryDb.attendance.has(tenantId) || (memoryDb.attendance.get(tenantId)?.length ?? 0) === 0) {
    const today = new Date().toISOString().substring(0, 10);
    const now = new Date();
    const att1 = {
      id: 'att_001',
      organizationId: tenantId,
      userId: 'usr_tech_rajesh',
      userName: 'Rajesh Kumar (Field Tech)',
      date: today,
      status: 'CLOCKED_IN',
      checkInAt: new Date(now.getTime() - 3.5 * 3600000).toISOString(),
      checkInLatitude: 28.5356,
      checkInLongitude: 77.2681,
      checkInAccuracyMeters: 8.5,
      isManuallyAdjusted: false,
      notes: 'Started shift at Okhla site.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const att2 = {
      id: 'att_002',
      organizationId: tenantId,
      userId: 'usr_tech_vikram',
      userName: 'Vikram Malhotra (Senior Engineer)',
      date: today,
      status: 'CLOCKED_OUT',
      checkInAt: new Date(now.getTime() - 8 * 3600000).toISOString(),
      checkInLatitude: 19.0760,
      checkInLongitude: 72.8777,
      checkInAccuracyMeters: 10.0,
      checkOutAt: new Date(now.getTime() - 0.5 * 3600000).toISOString(),
      checkOutLatitude: 19.0761,
      checkOutLongitude: 72.8778,
      durationSeconds: 27000,
      isManuallyAdjusted: false,
      notes: 'Shift completed. 7.5 hours logged.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const att3 = {
      id: 'att_003',
      organizationId: tenantId,
      userId: 'usr_tech_priya',
      userName: 'Priya Sharma (Solar Specialist)',
      date: today,
      status: 'CLOCKED_IN',
      checkInAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
      checkInLatitude: 12.8452,
      checkInLongitude: 77.6602,
      checkInAccuracyMeters: 12.0,
      isManuallyAdjusted: false,
      notes: 'On duty at Electronic City.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryDb.attendance.set(tenantId, [att1, att2, att3]);
  }
}
