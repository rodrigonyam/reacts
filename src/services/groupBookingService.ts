/**
 * Group scheduling & recurring bookings service.
 * Pure functions — all mutations return new arrays and persist to localStorage.
 */
import { addDays, addWeeks, addMonths, parseISO, format, isBefore, isAfter } from 'date-fns';
import type { GroupClass, GroupEnrollment } from '../types';

const GROUP_CLASSES_KEY = 'sos_group_classes';
const ENROLLMENTS_KEY   = 'sos_group_enrollments';

// ── Persistence ────────────────────────────────────────────────────────────────

export function loadGroupClasses(): GroupClass[] {
  try {
    const raw = localStorage.getItem(GROUP_CLASSES_KEY);
    return raw ? (JSON.parse(raw) as GroupClass[]) : [];
  } catch {
    return [];
  }
}

export function saveGroupClasses(classes: GroupClass[]): void {
  localStorage.setItem(GROUP_CLASSES_KEY, JSON.stringify(classes));
}

export function loadEnrollments(): GroupEnrollment[] {
  try {
    const raw = localStorage.getItem(ENROLLMENTS_KEY);
    return raw ? (JSON.parse(raw) as GroupEnrollment[]) : [];
  } catch {
    return [];
  }
}

export function saveEnrollments(enrollments: GroupEnrollment[]): void {
  localStorage.setItem(ENROLLMENTS_KEY, JSON.stringify(enrollments));
}

// ── Group Class CRUD ───────────────────────────────────────────────────────────

export function addGroupClass(
  classes: GroupClass[],
  data: Omit<GroupClass, 'id' | 'createdAt' | 'updatedAt' | 'enrolledCount'>,
): GroupClass[] {
  const now = new Date().toISOString();
  const newClass: GroupClass = {
    ...data,
    id: `gc-${Date.now()}`,
    enrolledCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const updated = [...classes, newClass];
  saveGroupClasses(updated);
  return updated;
}

export function updateGroupClass(
  classes: GroupClass[],
  id: string,
  changes: Partial<Omit<GroupClass, 'id' | 'createdAt'>>,
): GroupClass[] {
  const updated = classes.map((c) =>
    c.id === id ? { ...c, ...changes, updatedAt: new Date().toISOString() } : c,
  );
  saveGroupClasses(updated);
  return updated;
}

export function deleteGroupClass(classes: GroupClass[], id: string): GroupClass[] {
  const updated = classes.filter((c) => c.id !== id);
  saveGroupClasses(updated);
  return updated;
}

// ── Enrollment ─────────────────────────────────────────────────────────────────

export function getClassEnrollments(
  enrollments: GroupEnrollment[],
  classId: string,
): GroupEnrollment[] {
  return enrollments.filter((e) => e.classId === classId && e.status !== 'cancelled');
}

export function enrollClient(
  enrollments: GroupEnrollment[],
  classes: GroupClass[],
  classId: string,
  clientId: string,
  clientName: string,
  clientEmail: string,
): { enrollments: GroupEnrollment[]; classes: GroupClass[] } {
  // Skip if already active in this class
  const already = enrollments.find(
    (e) => e.classId === classId && e.clientId === clientId && e.status !== 'cancelled',
  );
  if (already) return { enrollments, classes };

  const targetClass = classes.find((c) => c.id === classId);
  const activeCount = enrollments.filter(
    (e) => e.classId === classId && e.status === 'enrolled',
  ).length;
  const isWaitlisted = targetClass ? activeCount >= targetClass.capacity : false;

  const newEnrollment: GroupEnrollment = {
    id: `enr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    classId,
    clientId,
    clientName,
    clientEmail,
    status: isWaitlisted ? 'waitlisted' : 'enrolled',
    enrolledAt: new Date().toISOString(),
  };

  const updatedEnrollments = [...enrollments, newEnrollment];
  saveEnrollments(updatedEnrollments);

  let updatedClasses = classes;
  if (!isWaitlisted) {
    updatedClasses = classes.map((c) =>
      c.id === classId
        ? { ...c, enrolledCount: c.enrolledCount + 1, updatedAt: new Date().toISOString() }
        : c,
    );
    saveGroupClasses(updatedClasses);
  }

  return { enrollments: updatedEnrollments, classes: updatedClasses };
}

export function unenrollClient(
  enrollments: GroupEnrollment[],
  classes: GroupClass[],
  enrollmentId: string,
): { enrollments: GroupEnrollment[]; classes: GroupClass[] } {
  const target = enrollments.find((e) => e.id === enrollmentId);
  if (!target) return { enrollments, classes };

  let updatedEnrollments = enrollments.map((e) =>
    e.id === enrollmentId ? { ...e, status: 'cancelled' as const } : e,
  );
  saveEnrollments(updatedEnrollments);

  let updatedClasses = classes;

  if (target.status === 'enrolled') {
    // Decrement count
    updatedClasses = classes.map((c) =>
      c.id === target.classId
        ? { ...c, enrolledCount: Math.max(0, c.enrolledCount - 1), updatedAt: new Date().toISOString() }
        : c,
    );
    saveGroupClasses(updatedClasses);

    // Promote first waitlisted person
    const firstWaitlisted = updatedEnrollments.find(
      (e) => e.classId === target.classId && e.status === 'waitlisted',
    );
    if (firstWaitlisted) {
      updatedEnrollments = updatedEnrollments.map((e) =>
        e.id === firstWaitlisted.id ? { ...e, status: 'enrolled' as const } : e,
      );
      saveEnrollments(updatedEnrollments);
      updatedClasses = updatedClasses.map((c) =>
        c.id === target.classId
          ? { ...c, enrolledCount: c.enrolledCount + 1, updatedAt: new Date().toISOString() }
          : c,
      );
      saveGroupClasses(updatedClasses);
    }
  }

  return { enrollments: updatedEnrollments, classes: updatedClasses };
}

// ── Recurrence ─────────────────────────────────────────────────────────────────

/** Generate upcoming ISO date strings for a GroupClass (up to maxCount). */
export function generateOccurrences(groupClass: GroupClass, maxCount = 20): string[] {
  const { recurrenceRule, startDate } = groupClass;
  const { frequency, occurrences, endDate, daysOfWeek } = recurrenceRule;

  if (frequency === 'none') return [startDate];

  const dates: string[] = [];
  const limit = occurrences ?? maxCount;
  const endLimit = endDate ? parseISO(endDate) : null;

  if (frequency === 'daily') {
    let current = parseISO(startDate);
    while (dates.length < limit) {
      if (endLimit && isAfter(current, endLimit)) break;
      dates.push(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 1);
    }
    return dates;
  }

  if (frequency === 'weekly' || frequency === 'biweekly') {
    const days = daysOfWeek && daysOfWeek.length > 0 ? [...daysOfWeek].sort((a, b) => a - b) : [parseISO(startDate).getDay()];
    const stepWeeks = frequency === 'biweekly' ? 2 : 1;
    let weekStart = parseISO(startDate);
    const startISO = parseISO(startDate);

    while (dates.length < limit) {
      for (const dow of days) {
        const diff = (dow - weekStart.getDay() + 7) % 7;
        const candidate = addDays(weekStart, diff);
        if (isBefore(candidate, startISO)) continue;
        if (endLimit && isAfter(candidate, endLimit)) return dates;
        if (dates.length >= limit) return dates;
        dates.push(format(candidate, 'yyyy-MM-dd'));
      }
      weekStart = addWeeks(weekStart, stepWeeks);
    }
    return dates;
  }

  if (frequency === 'monthly') {
    let current = parseISO(startDate);
    while (dates.length < limit) {
      if (endLimit && isAfter(current, endLimit)) break;
      dates.push(format(current, 'yyyy-MM-dd'));
      current = addMonths(current, 1);
    }
    return dates;
  }

  return dates;
}

/** Human-readable recurrence summary, e.g. "Weekly · Mon, Wed · 12 sessions" */
export function recurrenceSummary(rule: GroupClass['recurrenceRule']): string {
  if (rule.frequency === 'none') return 'One-time session';

  const freqLabel: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    biweekly: 'Every 2 weeks',
    monthly: 'Monthly',
  };

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayPart =
    rule.daysOfWeek && rule.daysOfWeek.length
      ? ' · ' + rule.daysOfWeek.map((d) => DAY_NAMES[d]).join(', ')
      : '';

  const endPart = rule.occurrences
    ? ` · ${rule.occurrences} sessions`
    : rule.endDate
    ? ` · until ${format(parseISO(rule.endDate), 'MMM d, yyyy')}`
    : '';

  return `${freqLabel[rule.frequency] ?? rule.frequency}${dayPart}${endPart}`;
}
