// ── Core domain types ─────────────────────────────────────────────────────────

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
}

export interface TimeSlot {
  id: string;
  date: string;        // ISO date string YYYY-MM-DD
  startTime: string;   // "HH:mm"
  endTime: string;     // "HH:mm"
  capacity: number;    // max bookings for this slot
  booked: number;      // current bookings
  available: boolean;
  serviceId?: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  color: string;       // hex – used for calendar event color
}

export interface Booking {
  id: string;
  userId: string;
  user?: User;
  slotId: string;
  slot?: TimeSlot;
  serviceId: string;
  service?: Service;
  status: BookingStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Form input types ──────────────────────────────────────────────────────────

export interface BookingFormData {
  name: string;
  email: string;
  phone: string;
  serviceId: string;
  date: string;
  slotId: string;
  notes?: string;
}

export interface SlotFormData {
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  serviceId?: string;
}

// ── Calendar event (extends react-big-calendar Event) ────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Booking;
  color?: string;
}

// ── API response wrappers ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
