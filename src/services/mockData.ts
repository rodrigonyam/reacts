/**
 * Mock data used as fallback when VITE_USE_MOCK=true (or no backend is running).
 * Replace / remove once your real API is connected.
 */
import type { Booking, Service, TimeSlot, User } from '../types';
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
