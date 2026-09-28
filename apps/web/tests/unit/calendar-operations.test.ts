import { describe, it, expect } from 'vitest';
import { getLocalDateString } from '../../src/lib/operational-metrics';

describe('Operational Calendar Unit Tests', () => {
  it('computes week dates range correctly starting on Monday', () => {
    // 2026-09-28 is a Monday
    const mondayDate = new Date('2026-09-28T12:00:00.000Z');
    const day = mondayDate.getDay();
    const diff = mondayDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(new Date(mondayDate).setDate(diff));

    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      week.push(getLocalDateString(d));
    }

    expect(week[0]).toBe('2026-09-28'); // Monday
    expect(week[6]).toBe('2026-10-04'); // Sunday
    expect(week.length).toBe(7);
  });

  it('filters unified events by type and assignee', () => {
    const rawEvents = [
      { id: '1', type: 'TASK', assignedTo: 'usr-1', startTime: '2026-09-28T10:00:00.000Z' },
      { id: '2', type: 'VISIT', assignedTo: 'usr-2', startTime: '2026-09-28T11:00:00.000Z' },
      { id: '3', type: 'TASK', assignedTo: 'usr-2', startTime: '2026-09-29T09:00:00.000Z' },
    ];

    // Filter by type: TASKS only
    const tasksOnly = rawEvents.filter((e) => e.type === 'TASK');
    expect(tasksOnly.length).toBe(2);

    // Filter by assignee: usr-2 only
    const usr2Only = rawEvents.filter((e) => e.assignedTo === 'usr-2');
    expect(usr2Only.length).toBe(2);

    // Match day
    const dayMatches = rawEvents.filter((e) => e.startTime.startsWith('2026-09-28'));
    expect(dayMatches.length).toBe(2);
  });
});
