// ── Core domain types ─────────────────────────────────────────────────────────

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

// ── Payment ───────────────────────────────────────────────────────────────────

export type PaymentStatus = 'unpaid' | 'processing' | 'paid' | 'failed' | 'refunded';

export interface PaymentInfo {
  status: PaymentStatus;
  amount: number;
  currency: string;
  intentId?: string;
  paidAt?: string;
  last4?: string;
  brand?: string;
}

// ── Reminders ─────────────────────────────────────────────────────────────────

export type ReminderChannel = 'email' | 'sms' | 'both';
export type ReminderTiming = '1week' | '24h' | '2h' | '30min';

export interface ReminderConfig {
  enabled: boolean;
  channels: ReminderChannel;
  timings: ReminderTiming[];
}

export interface ScheduledReminder {
  id: string;
  bookingId: string;
  channel: 'email' | 'sms';
  timing: ReminderTiming;
  scheduledFor: string;
  sentAt?: string;
  status: 'pending' | 'sent' | 'failed';
}

// ── Reschedule ────────────────────────────────────────────────────────────────

export interface RescheduleToken {
  token: string;
  bookingId: string;
  expiresAt: string;
  used: boolean;
}

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
  payment?: PaymentInfo;
  reminders?: ScheduledReminder[];
  rescheduleToken?: string;
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
  reminderChannels?: ReminderChannel;
  reminderTimings?: ReminderTiming[];
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
