/**
 * BookingPage — public self-service booking page.
 * Clients reach this at /book or /book/:serviceId (no login required).
 *
 * Steps:
 *  1. Choose a service
 *  2. Pick a date & time slot
 *  3. Fill out the intake form
 *  4. Pay
 *  5. Confirmation
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, addDays, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useBookingStore } from '../store/bookingStore';
import { PaymentForm } from '../components/payment/PaymentForm';
import { Spinner } from '../components/ui/Spinner';
import type { Service, TimeSlot, PaymentInfo, PaymentGatewaySettings } from '../types';
import { MOCK_SERVICES, MOCK_SLOTS } from '../services/mockData';
import { loadGatewaySettings } from '../services/paymentGatewayService';
import {
  COMMON_TIMEZONES,
  convertSlotRange,
  convertSlotTime,
  getTimezoneBadge,
  isSameTimezone,
} from '../services/timezoneService';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.DEV;

// ── Step labels ───────────────────────────────────────────────────────────────
const STEPS = ['Service', 'Date & Time', 'Your Details', 'Payment', 'Confirmation'];

// ── Intake form types ─────────────────────────────────────────────────────────
interface IntakeData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  emergencyName: string;
  emergencyPhone: string;
  insuranceProvider: string;
  insuranceId: string;
  currentMedications: string;
  allergies: string;
  goals: string;
  notes: string;
  agreeToTerms: boolean;
}

const EMPTY_INTAKE: IntakeData = {
  firstName: '', lastName: '', email: '', phone: '', dob: '',
  emergencyName: '', emergencyPhone: '',
  insuranceProvider: '', insuranceId: '',
  currentMedications: '', allergies: '', goals: '', notes: '',
  agreeToTerms: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors
                  ${done ? 'bg-sky-600 text-white' : active ? 'border-2 border-sky-600 bg-white text-sky-600' : 'border-2 border-gray-300 bg-white text-gray-400'}`}
              >
                {done ? '✓' : n}
              </div>
              <span className={`mt-1 text-[10px] font-medium ${active ? 'text-sky-600' : done ? 'text-sky-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mb-4 h-0.5 w-10 sm:w-12 flex-shrink-0 ${done ? 'bg-sky-500' : 'bg-gray-200'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ServiceCard({
  service,
  selected,
  onSelect,
}: {
  service: Service;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border-2 p-5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-sky-400
        ${selected ? 'border-sky-500 bg-sky-50 shadow-md' : 'border-gray-200 bg-white hover:border-sky-300 hover:shadow-sm'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white text-lg font-bold"
            style={{ backgroundColor: service.color }}
          >
            {service.name[0]}
          </span>
          <div>
            <p className="font-semibold text-gray-900">{service.name}</p>
            <p className="mt-0.5 text-sm text-gray-500">{service.description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end text-right flex-shrink-0">
          <span className="text-lg font-bold text-sky-700">${service.price}</span>
          <span className="text-xs text-gray-400">{service.durationMinutes} min</span>
        </div>
      </div>
      {selected && (
        <div className="mt-3 flex items-center gap-1.5 text-sm font-medium text-sky-600">
          <span>✓</span> Selected
        </div>
      )}
    </button>
  );
}

// ── Generate next-14-day array ────────────────────────────────────────────────
function buildDateRange() {
  const today = new Date();
  return Array.from({ length: 14 }, (_, i) => addDays(today, i));
}

// ── Input component helper ────────────────────────────────────────────────────
function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const INPUT_CLS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';

// ── Confirmation card ─────────────────────────────────────────────────────────
interface ConfirmationProps {
  bookingId: string;
  service: Service;
  slot: TimeSlot;
  intake: IntakeData;
  payment: PaymentInfo;
  clientTimezone: string;
  providerTimezone: string;
}
function ConfirmationCard({ bookingId, service, slot, intake, payment, clientTimezone, providerTimezone }: ConfirmationProps) {
  const slotDate = parseISO(`${slot.date}T${slot.startTime}:00`);
  const calStart = `${slot.date}T${slot.startTime}:00`.replace(/[-:]/g, '').replace('T', 'T');
  const calEnd = `${slot.date}T${slot.endTime}:00`.replace(/[-:]/g, '').replace('T', 'T');
  const gcalLink =
    `https://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(service.name)}&dates=${calStart}/${calEnd}&details=${encodeURIComponent('Booking ID: ' + bookingId)}`;

  const sameZone = isSameTimezone(clientTimezone, providerTimezone);
  const displayTimeRange = sameZone
    ? `${slot.startTime} – ${slot.endTime}`
    : convertSlotRange(slot.date, slot.startTime, slot.endTime, providerTimezone, clientTimezone);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
        <span className="text-4xl">✅</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900">You're all set!</h2>
      <p className="mt-2 text-gray-500">
        A confirmation has been sent to <strong>{intake.email}</strong>.
      </p>

      <div className="mt-6 w-full rounded-xl border border-gray-200 bg-gray-50 p-5 text-left">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Booking Details</span>
          <span className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-700">Confirmed</span>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Booking ID</dt>
            <dd className="font-mono font-semibold text-gray-900">{bookingId}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Service</dt>
            <dd className="font-medium text-gray-900">{service.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Date</dt>
            <dd className="font-medium text-gray-900">{format(slotDate, 'EEEE, MMMM d, yyyy')}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Time</dt>
            <dd className="font-medium text-gray-900">
              {displayTimeRange}
              <span className="ml-1 text-xs text-gray-400">{getTimezoneBadge(clientTimezone)}</span>
              {!sameZone && (
                <div className="text-xs text-gray-400">
                  {slot.startTime} – {slot.endTime}{' '}
                  <span>{getTimezoneBadge(providerTimezone)}</span>
                </div>
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Client</dt>
            <dd className="font-medium text-gray-900">{intake.firstName} {intake.lastName}</dd>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2">
            <dt className="text-gray-500">Paid</dt>
            <dd className="font-bold text-green-700">
              ${(payment.amount / 100).toFixed(2)} •••• {payment.last4}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <a
          href={gcalLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          📅 Add to Google Calendar
        </a>
        <Link
          to="/"
          className="flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
        >
          Done
        </Link>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Page Component
// ══════════════════════════════════════════════════════════════════════════════
export function BookingPage() {
  const { serviceId: preselectedServiceId } = useParams<{ serviceId?: string }>();
  const {
    slots: storeSlots,
    services: storeServices,
    fetchSlots,
    fetchServices,
    clientTimezone,
    providerTimezone,
    setClientTimezone,
  } = useBookingStore();

  // Resolve services & slots — prefer store, fall back to mock
  const services: Service[] = storeServices.length > 0 ? storeServices : MOCK_SERVICES;
  const allSlots: TimeSlot[] = storeSlots.length > 0 ? storeSlots : MOCK_SLOTS;

  const [step, setStep] = useState(1);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Step 1
  const [selectedService, setSelectedService] = useState<Service | null>(
    preselectedServiceId ? (services.find((s) => s.id === preselectedServiceId) ?? null) : null,
  );

  // Step 2
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [showTzPicker, setShowTzPicker] = useState(false);

  // Step 3
  const [intake, setIntake] = useState<IntakeData>(EMPTY_INTAKE);
  const [intakeErrors, setIntakeErrors] = useState<Partial<Record<keyof IntakeData, string>>>({});

  // Step 5 (after payment)
  const [confirmedBookingId, setConfirmedBookingId] = useState('');
  const [confirmedPayment, setConfirmedPayment] = useState<PaymentInfo | null>(null);

  // Load services & initial slots
  useEffect(() => {
    fetchServices();
    fetchSlots(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load slots when date changes
  useEffect(() => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    if (USE_MOCK) {
      setLoadingSlots(false);
    } else {
      fetchSlots(selectedDate).finally(() => setLoadingSlots(false));
    }
  }, [selectedDate, fetchSlots]);

  // Visible slots for the selected date + service
  const visibleSlots = allSlots.filter(
    (s) =>
      s.date === selectedDate &&
      (!selectedService || !s.serviceId || s.serviceId === selectedService.id),
  );

  // ── Step navigation ──────────────────────────────────────────────────────
  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length));
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  // ── Step 3 validation ────────────────────────────────────────────────────
  const validateIntake = (): boolean => {
    const errs: Partial<Record<keyof IntakeData, string>> = {};
    if (!intake.firstName.trim()) errs.firstName = 'First name is required.';
    if (!intake.lastName.trim()) errs.lastName = 'Last name is required.';
    if (!intake.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errs.email = 'Enter a valid email.';
    if (intake.phone.replace(/\D/g, '').length < 7) errs.phone = 'Enter a valid phone number.';
    if (!intake.dob) errs.dob = 'Date of birth is required.';
    if (!intake.emergencyName.trim()) errs.emergencyName = 'Emergency contact name is required.';
    if (!intake.emergencyPhone.trim()) errs.emergencyPhone = 'Emergency contact phone is required.';
    if (!intake.agreeToTerms) errs.agreeToTerms = 'You must agree to the terms.';
    setIntakeErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Payment success → create booking ────────────────────────────────────
  const handlePaymentSuccess = (payment: PaymentInfo) => {
    if (!selectedService || !selectedSlot) return;
    const bookingId = `BK-${Date.now().toString(36).toUpperCase()}`;
    setConfirmedBookingId(bookingId);
    setConfirmedPayment(payment);
    toast.success('Booking confirmed!');
    setStep(5);
  };

  // ── Intake change helper ─────────────────────────────────────────────────
  const setField = <K extends keyof IntakeData>(key: K, value: IntakeData[K]) => {
    setIntake((prev) => ({ ...prev, [key]: value }));
    if (intakeErrors[key]) setIntakeErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50">
      {/* Header */}
      <header className="border-b border-white/60 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📆</span>
            <span className="text-lg font-bold text-gray-900">BookEase</span>
          </div>
          <Link to="/" className="text-sm text-sky-600 hover:underline">
            ← Admin Dashboard
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Hero copy */}
        {step < 5 && (
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Book Your Appointment</h1>
            <p className="mt-1 text-gray-500">Choose a service, pick a time, and you're done.</p>
          </div>
        )}

        {/* Step indicator */}
        {step < 5 && (
          <div className="mb-8 flex justify-center overflow-x-auto pb-2">
            <StepIndicator current={step} />
          </div>
        )}

        {/* Card */}
        <div className="rounded-2xl border border-white bg-white/90 shadow-lg backdrop-blur-sm">
          <div className="p-6 sm:p-8">

            {/* ────────────── STEP 1: Choose Service ───────────────────── */}
            {step === 1 && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Choose a service</h2>
                <div className="space-y-3">
                  {services.map((svc) => (
                    <ServiceCard
                      key={svc.id}
                      service={svc}
                      selected={selectedService?.id === svc.id}
                      onSelect={() => setSelectedService(svc)}
                    />
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    disabled={!selectedService}
                    onClick={goNext}
                    className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next: Pick a Time →
                  </button>
                </div>
              </div>
            )}

            {/* ────────────── STEP 2: Date & Time ──────────────────────── */}
            {step === 2 && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  Pick a date & time
                  {selectedService && (
                    <span
                      className="ml-2 rounded-full px-2 py-0.5 text-sm font-normal text-white"
                      style={{ backgroundColor: selectedService.color }}
                    >
                      {selectedService.name}
                    </span>
                  )}
                </h2>

                {/* ── Timezone banner ─────────────────────────────────── */}
                <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-sky-800">
                      <span>🌍</span>
                      <span>
                        Times shown in{' '}
                        <strong>{getTimezoneBadge(clientTimezone)}</strong>
                        {!isSameTimezone(clientTimezone, providerTimezone) && (
                          <span className="ml-1 text-sky-600">
                            · Provider is in{' '}
                            <span className="font-medium">{getTimezoneBadge(providerTimezone)}</span>
                          </span>
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTzPicker((v) => !v)}
                      className="text-xs font-medium text-sky-600 hover:text-sky-800 hover:underline"
                    >
                      {showTzPicker ? 'Hide' : 'Change timezone'}
                    </button>
                  </div>
                  {showTzPicker && (
                    <div className="mt-3">
                      <select
                        value={clientTimezone}
                        onChange={(e) => {
                          setClientTimezone(e.target.value);
                          setShowTzPicker(false);
                        }}
                        className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      >
                        {COMMON_TIMEZONES.map((tz) => (
                          <option key={tz.iana} value={tz.iana}>
                            {tz.label} — {tz.iana}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Date strip */}
                <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
                  {buildDateRange().map((d) => {
                    const iso = format(d, 'yyyy-MM-dd');
                    const isToday = iso === format(new Date(), 'yyyy-MM-dd');
                    const active = iso === selectedDate;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setSelectedDate(iso)}
                        className={`flex flex-shrink-0 flex-col items-center rounded-xl px-3 py-2 text-xs font-medium transition-colors
                          ${active ? 'bg-sky-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-sky-50 hover:text-sky-700'}`}
                      >
                        <span className="text-[10px] uppercase">{format(d, 'EEE')}</span>
                        <span className="mt-0.5 text-base font-bold">{format(d, 'd')}</span>
                        <span className="text-[10px]">{format(d, 'MMM')}</span>
                        {isToday && <span className="mt-0.5 text-[9px] font-semibold">Today</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Time slots */}
                {loadingSlots ? (
                  <div className="py-8"><Spinner /></div>
                ) : visibleSlots.length === 0 ? (
                  <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    No available slots on this date. Please pick another day.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {visibleSlots.map((slot) => {
                      const full = !slot.available;
                      const chosen = selectedSlot?.id === slot.id;
                      const sameZone = isSameTimezone(clientTimezone, providerTimezone);
                      const displayTime = sameZone
                        ? slot.startTime
                        : convertSlotTime(slot.date, slot.startTime, providerTimezone, clientTimezone);
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={full}
                          onClick={() => setSelectedSlot(slot)}
                          className={`rounded-lg border-2 px-3 py-3 text-center text-sm font-medium transition-all
                            ${full ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300 line-through' :
                              chosen ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm' :
                              'border-gray-200 bg-white text-gray-700 hover:border-sky-300 hover:bg-sky-50'}`}
                        >
                          <div>{displayTime}</div>
                          {!sameZone && !full && (
                            <div className="mt-0.5 text-[9px] text-gray-400">
                              {slot.startTime} {getTimezoneBadge(providerTimezone)}
                            </div>
                          )}
                          <div className="mt-0.5 text-[10px] text-gray-400">
                            {full ? 'Full' : `${slot.capacity - slot.booked} left`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6 flex justify-between">
                  <button type="button" onClick={goBack} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                    ← Back
                  </button>
                  <button
                    type="button"
                    disabled={!selectedSlot}
                    onClick={goNext}
                    className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next: Your Details →
                  </button>
                </div>
              </div>
            )}

            {/* ────────────── STEP 3: Intake Form ──────────────────────── */}
            {step === 3 && (
              <div>
                <h2 className="mb-1 text-lg font-semibold text-gray-900">Your details</h2>
                <p className="mb-5 text-sm text-gray-500">
                  This information helps us provide the best care. All fields marked <span className="text-red-500">*</span> are required.
                </p>

                <div className="space-y-5">
                  {/* Personal info */}
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Personal Information</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="First Name" required error={intakeErrors.firstName}>
                        <input
                          type="text"
                          value={intake.firstName}
                          onChange={(e) => setField('firstName', e.target.value)}
                          placeholder="Jane"
                          className={INPUT_CLS}
                        />
                      </Field>
                      <Field label="Last Name" required error={intakeErrors.lastName}>
                        <input
                          type="text"
                          value={intake.lastName}
                          onChange={(e) => setField('lastName', e.target.value)}
                          placeholder="Smith"
                          className={INPUT_CLS}
                        />
                      </Field>
                      <Field label="Email" required error={intakeErrors.email}>
                        <input
                          type="email"
                          value={intake.email}
                          onChange={(e) => setField('email', e.target.value)}
                          placeholder="jane@example.com"
                          className={INPUT_CLS}
                        />
                      </Field>
                      <Field label="Phone" required error={intakeErrors.phone}>
                        <input
                          type="tel"
                          value={intake.phone}
                          onChange={(e) => setField('phone', e.target.value)}
                          placeholder="555-0100"
                          className={INPUT_CLS}
                        />
                      </Field>
                      <Field label="Date of Birth" required error={intakeErrors.dob}>
                        <input
                          type="date"
                          value={intake.dob}
                          onChange={(e) => setField('dob', e.target.value)}
                          className={INPUT_CLS}
                        />
                      </Field>
                    </div>
                  </div>

                  {/* Emergency contact */}
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Emergency Contact</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Contact Name" required error={intakeErrors.emergencyName}>
                        <input
                          type="text"
                          value={intake.emergencyName}
                          onChange={(e) => setField('emergencyName', e.target.value)}
                          placeholder="John Smith"
                          className={INPUT_CLS}
                        />
                      </Field>
                      <Field label="Contact Phone" required error={intakeErrors.emergencyPhone}>
                        <input
                          type="tel"
                          value={intake.emergencyPhone}
                          onChange={(e) => setField('emergencyPhone', e.target.value)}
                          placeholder="555-0199"
                          className={INPUT_CLS}
                        />
                      </Field>
                    </div>
                  </div>

                  {/* Insurance */}
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Insurance (optional)</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Insurance Provider">
                        <input
                          type="text"
                          value={intake.insuranceProvider}
                          onChange={(e) => setField('insuranceProvider', e.target.value)}
                          placeholder="Blue Cross"
                          className={INPUT_CLS}
                        />
                      </Field>
                      <Field label="Member / Policy ID">
                        <input
                          type="text"
                          value={intake.insuranceId}
                          onChange={(e) => setField('insuranceId', e.target.value)}
                          placeholder="XYZ123456"
                          className={INPUT_CLS}
                        />
                      </Field>
                    </div>
                  </div>

                  {/* Health Notes */}
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Health & Goals</p>
                    <div className="space-y-4">
                      <Field label="Current Medications">
                        <textarea
                          rows={2}
                          value={intake.currentMedications}
                          onChange={(e) => setField('currentMedications', e.target.value)}
                          placeholder="List any medications you are currently taking…"
                          className={INPUT_CLS}
                        />
                      </Field>
                      <Field label="Allergies or Medical Alerts">
                        <input
                          type="text"
                          value={intake.allergies}
                          onChange={(e) => setField('allergies', e.target.value)}
                          placeholder="e.g. Penicillin, latex…"
                          className={INPUT_CLS}
                        />
                      </Field>
                      <Field label="Goals for this visit">
                        <textarea
                          rows={2}
                          value={intake.goals}
                          onChange={(e) => setField('goals', e.target.value)}
                          placeholder="What would you like to achieve or discuss during this appointment?"
                          className={INPUT_CLS}
                        />
                      </Field>
                      <Field label="Additional Notes">
                        <textarea
                          rows={2}
                          value={intake.notes}
                          onChange={(e) => setField('notes', e.target.value)}
                          placeholder="Anything else we should know…"
                          className={INPUT_CLS}
                        />
                      </Field>
                    </div>
                  </div>

                  {/* Terms */}
                  <div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={intake.agreeToTerms}
                        onChange={(e) => setField('agreeToTerms', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-sm text-gray-600">
                        I agree to the{' '}
                        <span className="cursor-pointer text-sky-600 underline">Terms of Service</span>{' '}
                        and{' '}
                        <span className="cursor-pointer text-sky-600 underline">Privacy Policy</span>,
                        and consent to the use of my health information for the purposes of this appointment.
                      </span>
                    </label>
                    {intakeErrors.agreeToTerms && (
                      <p className="mt-1 text-xs text-red-600">{intakeErrors.agreeToTerms}</p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-between">
                  <button type="button" onClick={goBack} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (validateIntake()) goNext(); }}
                    className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
                  >
                    Next: Payment →
                  </button>
                </div>
              </div>
            )}

            {/* ────────────── STEP 4: Payment ───────────────────────────── */}
            {step === 4 && selectedService && (
              <div>
                <h2 className="mb-2 text-lg font-semibold text-gray-900">Payment</h2>

                {/* Booking summary mini-card */}
                <div className="mb-5 rounded-xl bg-gray-50 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{selectedService.name}</p>
                      {selectedSlot && (
                        <p className="text-gray-500">
                          {format(parseISO(`${selectedSlot.date}T${selectedSlot.startTime}:00`), 'EEE, MMM d')} · {selectedSlot.startTime} – {selectedSlot.endTime}
                        </p>
                      )}
                      <p className="text-gray-500">
                        {intake.firstName} {intake.lastName} · {intake.email}
                      </p>
                    </div>
                    <span className="text-xl font-bold text-sky-700">${selectedService.price}</span>
                  </div>
                </div>

                <PaymentForm
                  amount={selectedService.price}
                  serviceName={selectedService.name}
                  onSuccess={handlePaymentSuccess}
                  onCancel={goBack}
                />
              </div>
            )}

            {/* ────────────── STEP 5: Confirmation ─────────────────────── */}
            {step === 5 && selectedService && selectedSlot && confirmedPayment && (
              <ConfirmationCard
                bookingId={confirmedBookingId}
                service={selectedService}
                slot={selectedSlot}
                intake={intake}
                payment={confirmedPayment}
                clientTimezone={clientTimezone}
                providerTimezone={providerTimezone}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-gray-400">
          Secure booking powered by BookEase · {new Date().getFullYear()}
        </p>
      </main>
    </div>
  );
}
