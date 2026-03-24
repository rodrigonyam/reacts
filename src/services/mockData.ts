/**
 * Mock data used as fallback when VITE_USE_MOCK=true (or no backend is running).
 * Replace / remove once your real API is connected.
 */
import type { Booking, Client, GroupClass, GroupEnrollment, Service, TimeSlot, User } from '../types';
import { addDays, format, setHours, setMinutes } from 'date-fns';

const today = new Date();

export const MOCK_SERVICES: Service[] = [
  { id: 's1', name: 'General Consultation', description: '30-minute general consultation', durationMinutes: 30, price: 50, color: '#0284c7' },
  { id: 's2', name: 'Physical Therapy', description: '60-minute physical therapy session', durationMinutes: 60, price: 90, color: '#7c3aed' },
  { id: 's3', name: 'Nutritional Counseling', description: '45-minute diet & nutrition session', durationMinutes: 45, price: 70, color: '#059669' },
  { id: 's4', name: 'Mental Wellness', description: '50-minute mental wellness session', durationMinutes: 50, price: 85, color: '#db2777' },
];

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Alice Johnson', email: 'alice@example.com', phone: '555-0101', createdAt: '2025-01-10T09:00:00Z' },
  { id: 'u2', name: 'Bob Williams', email: 'bob@example.com', phone: '555-0102', createdAt: '2025-02-14T11:00:00Z' },
  { id: 'u3', name: 'Carol Martinez', email: 'carol@example.com', phone: '555-0103', createdAt: '2025-03-05T14:00:00Z' },
];

function makeSlot(offsetDays: number, hour: number, serviceId?: string, capacity = 3, booked = 0): TimeSlot {
  const d = addDays(today, offsetDays);
  const start = setMinutes(setHours(d, hour), 0);
  const end = setMinutes(setHours(d, hour + 1), 0);
  return {
    id: `slot-${offsetDays}-${hour}`,
    date: format(d, 'yyyy-MM-dd'),
    startTime: format(start, 'HH:mm'),
    endTime: format(end, 'HH:mm'),
    capacity,
    booked,
    available: booked < capacity,
    serviceId,
  };
}

export const MOCK_SLOTS: TimeSlot[] = [
  makeSlot(0, 9, 's1', 3, 1),
  makeSlot(0, 10, 's2', 2, 0),
  makeSlot(0, 14, 's3', 3, 2),
  makeSlot(1, 9, 's1', 3, 0),
  makeSlot(1, 11, 's4', 2, 1),
  makeSlot(2, 10, 's2', 2, 0),
  makeSlot(2, 13, 's3', 3, 0),
  makeSlot(3, 9, 's1', 3, 3),   // fully booked
  makeSlot(4, 14, 's4', 2, 0),
  makeSlot(5, 10, 's1', 3, 0),
];

function makeBooking(id: string, userId: string, slotIdx: number, serviceIdx: number, status: Booking['status']): Booking {
  const slot = MOCK_SLOTS[slotIdx];
  const service = MOCK_SERVICES[serviceIdx];
  const user = MOCK_USERS.find((u) => u.id === userId)!;
  return {
    id,
    userId,
    user,
    slotId: slot.id,
    slot,
    serviceId: service.id,
    service,
    status,
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const MOCK_BOOKINGS: Booking[] = [
  makeBooking('b1', 'u1', 0, 0, 'confirmed'),
  makeBooking('b2', 'u2', 2, 2, 'pending'),
  makeBooking('b3', 'u3', 4, 3, 'confirmed'),
  makeBooking('b4', 'u1', 1, 1, 'cancelled'),
];

// ── Mock Clients ──────────────────────────────────────────────────────────────

export const MOCK_CLIENTS: Client[] = [
  {
    id: 'c1',
    firstName: 'Alice',
    lastName: 'Johnson',
    email: 'alice@example.com',
    phone: '555-0101',
    dateOfBirth: '1952-04-18',
    address: '14 Maple Street, Springfield, IL 62701',
    emergencyContact: 'David Johnson (Son)',
    emergencyPhone: '555-0199',
    notes: [
      { id: 'n1a', content: 'Prefers morning slots before 11am.', createdAt: '2025-06-01T09:00:00Z' },
      { id: 'n1b', content: 'Has mild knee arthritis — avoid high-impact exercises.', createdAt: '2025-07-15T10:30:00Z' },
    ],
    tags: ['VIP', 'mobility-issues', 'morning-pref'],
    status: 'active',
    userId: 'u1',
    createdAt: '2025-01-10T09:00:00Z',
    updatedAt: '2025-07-15T10:30:00Z',
  },
  {
    id: 'c2',
    firstName: 'Bob',
    lastName: 'Williams',
    email: 'bob@example.com',
    phone: '555-0102',
    dateOfBirth: '1948-11-02',
    address: '8 Oak Avenue, Riverside, CA 92501',
    emergencyContact: 'Susan Williams (Wife)',
    emergencyPhone: '555-0198',
    notes: [
      { id: 'n2a', content: 'Takes blood pressure medication — check before intense sessions.', createdAt: '2025-03-20T14:00:00Z' },
    ],
    tags: ['hypertension', 'needs-monitoring'],
    status: 'active',
    userId: 'u2',
    createdAt: '2025-02-14T11:00:00Z',
    updatedAt: '2025-03-20T14:00:00Z',
  },
  {
    id: 'c3',
    firstName: 'Carol',
    lastName: 'Martinez',
    email: 'carol@example.com',
    phone: '555-0103',
    dateOfBirth: '1955-08-30',
    address: '22 Pine Road, Austin, TX 78701',
    emergencyContact: 'Luis Martinez (Husband)',
    emergencyPhone: '555-0197',
    notes: [
      { id: 'n3a', content: 'Very motivated, asks lots of detailed questions — schedule extra 10 min buffer.', createdAt: '2025-04-05T11:00:00Z' },
    ],
    tags: ['highly-engaged', 'nutrition-focus'],
    status: 'active',
    userId: 'u3',
    createdAt: '2025-03-05T14:00:00Z',
    updatedAt: '2025-04-05T11:00:00Z',
  },
  {
    id: 'c4',
    firstName: 'Dorothy',
    lastName: 'Chen',
    email: 'dorothy.chen@example.com',
    phone: '555-0104',
    dateOfBirth: '1943-02-14',
    address: '5 Birch Lane, Portland, OR 97201',
    emergencyContact: 'Kevin Chen (Son)',
    emergencyPhone: '555-0196',
    notes: [],
    tags: ['balance-issues', 'walker-assist'],
    status: 'inactive',
    createdAt: '2024-11-20T10:00:00Z',
    updatedAt: '2025-01-10T08:00:00Z',
  },
];

// ── Mock Group Classes ────────────────────────────────────────────────────────

export const MOCK_GROUP_CLASSES: GroupClass[] = [
  {
    id: 'gc1',
    name: 'Morning Mobility Circle',
    description: 'Gentle joint mobilization and stretching exercises designed for older adults.',
    serviceId: 's2',
    instructorName: 'Dr. Sarah Park',
    location: 'Studio A',
    capacity: 8,
    enrolledCount: 4,
    tags: ['mobility', 'low-impact', 'senior-friendly'],
    status: 'active',
    startDate: format(addDays(today, 1), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00',
    recurrenceRule: { frequency: 'weekly', occurrences: 12, daysOfWeek: [1, 3] },
    color: '#7c3aed',
    createdAt: '2025-12-01T08:00:00Z',
    updatedAt: '2025-12-01T08:00:00Z',
  },
  {
    id: 'gc2',
    name: 'Chair Yoga & Balance',
    description: 'Seated and standing yoga poses with balance training to improve stability and flexibility.',
    serviceId: 's1',
    instructorName: 'Lisa Tran',
    location: 'Studio B',
    capacity: 6,
    enrolledCount: 2,
    tags: ['yoga', 'balance', 'chair-friendly'],
    status: 'active',
    startDate: format(addDays(today, 2), 'yyyy-MM-dd'),
    startTime: '10:30',
    endTime: '11:15',
    recurrenceRule: { frequency: 'weekly', occurrences: 8, daysOfWeek: [2, 4] },
    color: '#059669',
    createdAt: '2025-12-05T09:00:00Z',
    updatedAt: '2025-12-05T09:00:00Z',
  },
  {
    id: 'gc3',
    name: 'Nutrition Workshop Series',
    description: 'Bi-weekly interactive workshop covering healthy eating, meal prep, and supplement guidance.',
    serviceId: 's3',
    instructorName: 'Dr. James Rivera',
    location: 'Conference Room',
    capacity: 10,
    enrolledCount: 2,
    tags: ['nutrition', 'workshop', 'interactive'],
    status: 'active',
    startDate: format(addDays(today, 4), 'yyyy-MM-dd'),
    startTime: '14:00',
    endTime: '15:30',
    recurrenceRule: { frequency: 'biweekly', occurrences: 6, daysOfWeek: [5] },
    color: '#db2777',
    createdAt: '2025-12-10T10:00:00Z',
    updatedAt: '2025-12-10T10:00:00Z',
  },
];

export const MOCK_ENROLLMENTS: GroupEnrollment[] = [
  { id: 'enr1', classId: 'gc1', clientId: 'c1', clientName: 'Alice Johnson', clientEmail: 'alice@example.com', status: 'enrolled', enrolledAt: '2025-12-05T09:00:00Z' },
  { id: 'enr2', classId: 'gc1', clientId: 'c2', clientName: 'Bob Williams', clientEmail: 'bob@example.com', status: 'enrolled', enrolledAt: '2025-12-05T09:30:00Z' },
  { id: 'enr3', classId: 'gc1', clientId: 'c3', clientName: 'Carol Martinez', clientEmail: 'carol@example.com', status: 'enrolled', enrolledAt: '2025-12-06T10:00:00Z' },
  { id: 'enr4', classId: 'gc1', clientId: 'c4', clientName: 'Dorothy Chen', clientEmail: 'dorothy.chen@example.com', status: 'enrolled', enrolledAt: '2025-12-06T10:30:00Z' },
  { id: 'enr5', classId: 'gc2', clientId: 'c1', clientName: 'Alice Johnson', clientEmail: 'alice@example.com', status: 'enrolled', enrolledAt: '2025-12-07T08:00:00Z' },
  { id: 'enr6', classId: 'gc2', clientId: 'c3', clientName: 'Carol Martinez', clientEmail: 'carol@example.com', status: 'enrolled', enrolledAt: '2025-12-07T08:30:00Z' },
  { id: 'enr7', classId: 'gc3', clientId: 'c2', clientName: 'Bob Williams', clientEmail: 'bob@example.com', status: 'enrolled', enrolledAt: '2025-12-12T09:00:00Z' },
  { id: 'enr8', classId: 'gc3', clientId: 'c3', clientName: 'Carol Martinez', clientEmail: 'carol@example.com', status: 'enrolled', enrolledAt: '2025-12-12T09:30:00Z' },
];
