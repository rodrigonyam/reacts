import type { StaffMember } from '../types';

const STAFF_KEY = 'sos_staff';

export function loadStaff(): StaffMember[] {
  try {
    const raw = localStorage.getItem(STAFF_KEY);
    return raw ? (JSON.parse(raw) as StaffMember[]) : [];
  } catch {
    return [];
  }
}

export function saveStaff(staff: StaffMember[]): void {
  localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
}

export function addStaffMember(
  staff: StaffMember[],
  data: Omit<StaffMember, 'id' | 'createdAt' | 'updatedAt'>,
): StaffMember[] {
  const now = new Date().toISOString();
  const member: StaffMember = { ...data, id: `staff-${Date.now()}`, createdAt: now, updatedAt: now };
  const updated = [member, ...staff];
  saveStaff(updated);
  return updated;
}

export function updateStaffMember(
  staff: StaffMember[],
  id: string,
  changes: Partial<Omit<StaffMember, 'id' | 'createdAt'>>,
): StaffMember[] {
  const updated = staff.map((m) =>
    m.id === id ? { ...m, ...changes, updatedAt: new Date().toISOString() } : m,
  );
  saveStaff(updated);
  return updated;
}

export function deleteStaffMember(staff: StaffMember[], id: string): StaffMember[] {
  const updated = staff.filter((m) => m.id !== id);
  saveStaff(updated);
  return updated;
}
