// ── Core domain types ─────────────────────────────────────────────────────────

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

// ── Calendar Sync ─────────────────────────────────────────────────────────────

export type ExternalCalendarProvider = 'google' | 'outlook' | 'apple' | 'ical';

/** An event pulled from an external calendar that blocks time */
export interface ExternalCalendarEvent {
  id: string;
  provider: ExternalCalendarProvider;
  externalId: string;
  title: string;          // may be "Busy" if privacy setting hides title
  start: string;          // ISO datetime
  end: string;            // ISO datetime
  allDay?: boolean;
  accountEmail?: string;
  calendarName?: string;
}

/** Represents a connected external calendar account */
export interface CalendarConnection {
  id: string;
  provider: ExternalCalendarProvider;
  accountEmail: string;
  calendarName: string;
  connectedAt: string;
  lastSyncedAt?: string;
  syncStatus: 'idle' | 'syncing' | 'error' | 'success';
  errorMessage?: string;
  color: string;
}

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
  rescheduleCount?: number;
  createdAt: string;
  updatedAt: string;
}

// ── Booking Policies ──────────────────────────────────────────────────────────

export interface RefundTier {
  /** Client must cancel at least this many hours before the appointment to get this refund percentage */
  hoursBeforeAppointment: number;
  refundPct: number; // 0–100
  label: string;     // e.g. "Full refund", "50% refund"
}

export interface BookingPolicy {
  // Reschedule rules
  rescheduleEnabled: boolean;
  /** 0 = unlimited */
  maxReschedules: number;
  /** Minimum hours before appointment that a client can reschedule */
  rescheduleNoticeHours: number;

  // Cancellation rules
  cancellationEnabled: boolean;
  /** Minimum hours before appointment that a client can cancel (0 = anytime) */
  cancellationNoticeHours: number;
  /** Sorted descending by hoursBeforeAppointment (most generous first) */
  refundTiers: RefundTier[];

  /** Admins can override policy restrictions */
  adminCanOverride: boolean;
}

export interface PolicyCheckResult {
  eligible: boolean;
  reason?: string;   // shown when not eligible
  warning?: string;  // shown when eligible but with caveat
  refundPct?: number;
  refundLabel?: string;
}

// ── Client Database ───────────────────────────────────────────────────────────

export type ClientStatus = 'active' | 'inactive';

export interface ClientNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;      // YYYY-MM-DD
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  notes: ClientNote[];        // private provider notes
  tags: string[];             // freeform labels e.g. "VIP", "mobility-issues"
  status: ClientStatus;
  /** Links to User.id / Booking.userId for cross-referencing bookings */
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Group Scheduling & Recurring Bookings ─────────────────────────────────────

export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  /** Total occurrences (mutually exclusive with endDate). Ignored when frequency is 'none'. */
  occurrences?: number;
  /** ISO date YYYY-MM-DD — last occurrence (alternative to occurrences). */
  endDate?: string;
  /** ISO weekday numbers 0=Sun … 6=Sat — applies to 'weekly' and 'biweekly' only. */
  daysOfWeek?: number[];
}

export type GroupClassStatus = 'active' | 'cancelled' | 'completed';

export interface GroupClass {
  id: string;
  name: string;
  description?: string;
  serviceId: string;
  instructorName?: string;
  location?: string;
  capacity: number;
  enrolledCount: number;
  tags: string[];
  status: GroupClassStatus;
  /** First session date YYYY-MM-DD */
  startDate: string;
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  recurrenceRule: RecurrenceRule;
  color?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type EnrollmentStatus = 'enrolled' | 'waitlisted' | 'cancelled';

export interface GroupEnrollment {
  id: string;
  classId: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  notes?: string;
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
