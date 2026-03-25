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
export type PaymentGateway = 'stripe' | 'paypal' | 'square';

export interface PaymentInfo {
  status: PaymentStatus;
  amount: number;           // cents — total amount (or deposit amount when paymentType='deposit')
  currency: string;
  gateway?: PaymentGateway;
  paymentType?: 'full' | 'deposit';
  depositAmount?: number;   // cents charged now (equals amount when paymentType='deposit')
  remainingBalance?: number; // cents due at appointment
  intentId?: string;
  paidAt?: string;
  last4?: string;
  brand?: string;
}

export interface GatewayConfig {
  enabled: boolean;
  testMode: boolean;
  publishableKey?: string;   // Stripe
  clientId?: string;         // PayPal
  applicationId?: string;    // Square
  locationId?: string;       // Square
}

export interface PaymentGatewaySettings {
  defaultGateway: PaymentGateway;
  gateways: Record<PaymentGateway, GatewayConfig>;
  depositEnabled: boolean;
  depositType: 'percent' | 'fixed';
  depositValue: number; // percent (0–100) or fixed cents
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

// ── Staff Management ──────────────────────────────────────────────────────────

export type StaffRole = 'provider' | 'instructor' | 'admin' | 'receptionist' | 'support';
export type StaffStatus = 'active' | 'inactive' | 'on-leave';

export interface StaffAvailabilitySlot {
  dayOfWeek: number;   // 0=Sun…6=Sat
  startTime: string;   // HH:mm
  endTime: string;     // HH:mm
}

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: StaffRole;
  bio?: string;
  serviceIds: string[];
  availability: StaffAvailabilitySlot[];
  status: StaffStatus;
  hireDate?: string;   // YYYY-MM-DD
  color: string;       // hex – used for calendar / avatar
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

// ── Waivers & Intake Forms ────────────────────────────────────────────────────

export type FormFieldType = 'text' | 'textarea' | 'checkbox' | 'radio' | 'select' | 'date' | 'number';

export interface WaiverFormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];    // for radio / select
  helpText?: string;
}

export interface WaiverTemplate {
  id: string;
  name: string;
  description?: string;
  waiverText: string;       // full legal / consent text
  requireSignature: boolean;
  requireInitials: boolean;
  /** Empty array means applies to ALL services */
  serviceIds: string[];
  customFields: WaiverFormField[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SignedWaiver {
  id: string;
  waiverId: string;
  waiverName: string;
  bookingId?: string;
  serviceId?: string;
  serviceName?: string;
  clientName: string;
  clientEmail: string;
  /** Typed full name used as digital signature */
  signatureName: string;
  customFieldResponses: Record<string, string | boolean>;
  signedAt: string;
}

// ── Branding & Customization ──────────────────────────────────────────────────

// ── Reviews & Testimonials ────────────────────────────────────────────────────

export interface Review {
  id: string;
  clientName: string;
  clientInitials: string;
  avatarColor: string;
  rating: number;          // 1–5
  comment: string;
  serviceName: string;
  date: string;            // ISO date string
  featured: boolean;
  approved: boolean;
  source: 'manual' | 'post-booking';
}

export interface ReviewsSettings {
  enabled: boolean;
  displayOnBookingPage: boolean;
  showRating: boolean;
  showDate: boolean;
  showServiceName: boolean;
  maxDisplayed: number;
  displayStyle: 'carousel' | 'grid' | 'list';
  heading: string;
  subheading: string;
}

export interface BrandingSettings {
  businessName: string;
  tagline: string;
  logoUrl: string;       // base64 data URL or external URL
  faviconUrl: string;
  primaryColor: string;  // hex e.g. '#0284c7'
  accentColor: string;   // hex
  fontFamily: string;    // CSS font-family string
  bookingPageTitle: string;
  bookingPageWelcomeText: string;
  customDomain: string;
  updatedAt: string;
}

// ── Integrations ─────────────────────────────────────────────────────────────

export interface ZoomSettings {
  enabled: boolean;
  accountId: string;             // Zoom Server-to-Server OAuth Account ID
  clientId: string;              // OAuth Client ID
  clientSecret: string;          // OAuth Client Secret (stored locally only)
  defaultDurationMinutes: number;
  autoCreateMeeting: boolean;    // auto-generate meeting link for every booking
  defaultPassword: string;       // optional default meeting password
  connectedAt?: string;          // ISO timestamp of last successful test/connect
}

export interface TeamsSettings {
  enabled: boolean;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  autoCreateMeeting: boolean;
  connectedAt?: string;
}

export interface VirtualMeetingInfo {
  platform: 'zoom' | 'teams' | 'other';
  meetingId: string;
  meetingUrl: string;
  meetingPassword?: string;
  hostUrl?: string;
  dialIn?: string;
}

// ── Analytics & Reports ───────────────────────────────────────────────────────

export interface BookingTrendPoint {
  date: string;          // YYYY-MM-DD
  count: number;
  revenue: number;       // cents
  completedCount: number;
  cancelledCount: number;
}

export interface ServiceBreakdown {
  serviceId: string;
  serviceName: string;
  count: number;
  revenue: number;       // cents
  color: string;
  completionRate: number; // 0–100
}

export interface StaffPerformance {
  staffId: string;
  staffName: string;
  appointmentsCompleted: number;
  appointmentsTotal: number;
  cancellationRate: number;  // 0–100
  revenue: number;           // cents
  avgSessionMinutes: number;
  clientRetentionRate: number; // 0–100 (% clients who booked again)
}

export interface RevenueBreakdown {
  label: string;
  amount: number;        // cents
  count: number;
  color: string;
}

export interface TopClient {
  clientId: string;
  clientName: string;
  totalBookings: number;
  totalSpent: number;    // cents
  lastVisit: string;     // YYYY-MM-DD
  status: 'active' | 'inactive';
}

export interface KPISnapshot {
  totalRevenue: number;         // cents
  totalBookings: number;
  completionRate: number;       // 0–100
  avgBookingValue: number;      // cents
  newClients: number;
  returningClients: number;
  revenueChange: number;        // % vs prior period (+/-)
  bookingsChange: number;       // % vs prior period (+/-)
  completionChange: number;     // percentage points
  avgValueChange: number;       // %
}

export type DateRangePreset = '7d' | '30d' | '90d' | 'mtd' | 'ytd' | 'custom';

export interface DateRange {
  start: string;   // YYYY-MM-DD
  end: string;     // YYYY-MM-DD
}

// ── Waiting List ──────────────────────────────────────────────────────────────

export type WaitlistStatus = 'waiting' | 'notified' | 'claimed' | 'expired';

export interface WaitlistEntry {
  id: string;
  slotId: string;
  serviceId: string;
  serviceName: string;
  slotDate: string;       // YYYY-MM-DD
  slotTime: string;       // HH:mm
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  status: WaitlistStatus;
  position: number;       // 1-based queue position within slot
  joinedAt: string;       // ISO datetime
  notifiedAt?: string;
  claimedAt?: string;
  expiresAt?: string;     // claim window end (notifiedAt + windowHours)
  notes?: string;
}

export interface WaitlistSettings {
  enabled: boolean;
  notificationWindowHours: number;  // how long client has to claim before next is notified
  maxPerSlot: number;               // max waitlist entries per slot
  autoNotify: boolean;              // auto-notify next in queue when slot opens
  notificationMessage: string;      // message template shown to client
}

// ── Marketing Tools ───────────────────────────────────────────────────────────

export type PromoType = 'percentage' | 'fixed' | 'bogo' | 'free_service';
export type PromoStatus = 'active' | 'scheduled' | 'paused' | 'expired';
export type DiscountType = 'percentage' | 'fixed';

export interface Promotion {
  id: string;
  name: string;
  description: string;
  type: PromoType;
  value: number;                    // percentage (0-100) or fixed cents
  minBookingAmount?: number;        // minimum booking amount in cents to apply
  applicableServiceIds: string[];   // empty = all services
  code?: string;                    // optional promo code tie-in
  status: PromoStatus;
  startDate: string;                // YYYY-MM-DD
  endDate: string;                  // YYYY-MM-DD
  usageLimit?: number;
  usageCount: number;
  createdAt: string;
}

export interface DailyDeal {
  id: string;
  serviceId: string;
  serviceName: string;
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;            // percentage (0-100) or fixed dollars
  dealPrice: number;                // pre-calculated final price (dollars)
  date: string;                     // YYYY-MM-DD — specific day or 'any' for recurring
  active: boolean;
  maxClaims?: number;
  claimsCount: number;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;                     // uppercase alphanumeric
  description: string;
  discountType: DiscountType;
  discountValue: number;            // percentage (0-100) or fixed dollars
  minAmount?: number;               // minimum booking $ to apply
  applicableServiceIds: string[];   // empty = all services
  usageLimit?: number;
  usageCount: number;
  expiresAt?: string;               // ISO datetime
  active: boolean;
  onePerClient: boolean;
  createdAt: string;
}

export interface AppliedDiscount {
  source: 'coupon' | 'deal' | 'promotion';
  label: string;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
}

export interface MarketingStats {
  activeCoupons: number;
  activeDeals: number;
  activePromotions: number;
  totalCouponUses: number;
  totalDealClaims: number;
  totalSavingsGiven: number;        // dollars
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
