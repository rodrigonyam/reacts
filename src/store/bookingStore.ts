import { create } from 'zustand';
import type { Booking, Client, GroupClass, GroupEnrollment, TimeSlot, Service, BookingStatus, ExternalCalendarEvent, ScheduledReminder, BookingPolicy } from '../types';
import { bookingService } from '../services/bookingService';
import { slotService } from '../services/slotService';
import { serviceService } from '../services/serviceService';
import { calendarSyncService } from '../services/calendarSyncService';
import { reminderService, buildMockAllReminders } from '../services/reminderService';
import { detectClientTimezone, DEFAULT_PROVIDER_TZ, PROVIDER_TZ_KEY } from '../services/timezoneService';
import { loadPolicy, savePolicy } from '../services/policyService';
import {
  addClient as svcAddClient,
  updateClient as svcUpdateClient,
  deleteClient as svcDeleteClient,
  addNote as svcAddNote,
  deleteNote as svcDeleteNote,
  editNote as svcEditNote,
  loadClients,
  saveClients,
} from '../services/clientService';
import {
  addGroupClass as svcAddGroupClass,
  updateGroupClass as svcUpdateGroupClass,
  deleteGroupClass as svcDeleteGroupClass,
  enrollClient as svcEnrollClient,
  unenrollClient as svcUnenrollClient,
  loadGroupClasses,
  saveGroupClasses,
  loadEnrollments,
  saveEnrollments,
} from '../services/groupBookingService';
import {
  MOCK_BOOKINGS,
  MOCK_CLIENTS,
  MOCK_GROUP_CLASSES,
  MOCK_ENROLLMENTS,
  MOCK_SLOTS,
  MOCK_SERVICES,
} from '../services/mockData';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.DEV;

interface BookingStore {
  bookings: Booking[];
  slots: TimeSlot[];
  services: Service[];
  externalEvents: ExternalCalendarEvent[];
  loading: boolean;
  error: string | null;

  // Bookings
  fetchBookings: () => Promise<void>;
  addBooking: (booking: Booking) => void;
  updateBookingStatus: (id: string, status: BookingStatus) => Promise<void>;
  removeBooking: (id: string) => Promise<void>;

  // Slots
  fetchSlots: (date?: string) => Promise<void>;
  addSlot: (slot: TimeSlot) => void;
  removeSlot: (id: string) => Promise<void>;

  // Services
  fetchServices: () => Promise<void>;

  // Reschedule
  rescheduleBooking: (bookingId: string, newSlotId: string) => Promise<void>;

  // Calendar Sync
  fetchExternalEvents: () => Promise<void>;

  // Reminders
  allReminders: ScheduledReminder[];
  fetchAllReminders: () => Promise<void>;
  resendReminder: (reminderId: string) => Promise<void>;
  cancelReminder: (reminderId: string) => Promise<void>;
  sendReminderNow: (bookingId: string, channel: 'email' | 'sms') => Promise<void>;

  // Timezones
  clientTimezone: string;
  providerTimezone: string;
  setClientTimezone: (tz: string) => void;
  setProviderTimezone: (tz: string) => void;

  // Policy
  policy: BookingPolicy;
  setPolicy: (policy: BookingPolicy) => void;

  // Clients
  clients: Client[];
  fetchClients: () => void;
  addClient: (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'notes'>) => void;
  updateClient: (id: string, changes: Partial<Omit<Client, 'id' | 'createdAt'>>) => void;
  deleteClient: (id: string) => void;
  addClientNote: (clientId: string, content: string) => void;
  deleteClientNote: (clientId: string, noteId: string) => void;
  editClientNote: (clientId: string, noteId: string, content: string) => void;

  // Group Scheduling
  groupClasses: GroupClass[];
  enrollments: GroupEnrollment[];
  fetchGroupClasses: () => void;
  addGroupClass: (data: Omit<GroupClass, 'id' | 'createdAt' | 'updatedAt' | 'enrolledCount'>) => void;
  updateGroupClass: (id: string, changes: Partial<Omit<GroupClass, 'id' | 'createdAt'>>) => void;
  deleteGroupClass: (id: string) => void;
  enrollClient: (classId: string, clientId: string, clientName: string, clientEmail: string) => void;
  unenrollClient: (enrollmentId: string) => void;

  // Utilities
  clearError: () => void;
}

export const useBookingStore = create<BookingStore>((set) => ({
  bookings: [],
  slots: [],
  services: [],
  externalEvents: [],
  allReminders: [],
  clients: loadClients(),
  groupClasses: loadGroupClasses(),
  enrollments: loadEnrollments(),
  loading: false,
  error: null,
  clientTimezone: detectClientTimezone(),
  providerTimezone: localStorage.getItem(PROVIDER_TZ_KEY) ?? DEFAULT_PROVIDER_TZ,
  policy: loadPolicy(),

  // ── Clients ───────────────────────────────────────────────────────────────
  fetchClients: () => {
    const stored = loadClients();
    if (USE_MOCK && stored.length === 0) {
      saveClients(MOCK_CLIENTS);
      set({ clients: MOCK_CLIENTS });
    } else {
      set({ clients: stored.length > 0 ? stored : USE_MOCK ? MOCK_CLIENTS : stored });
    }
  },

  addClient: (data) =>
    set((state) => ({ clients: svcAddClient(state.clients, data) })),

  updateClient: (id, changes) =>
    set((state) => ({ clients: svcUpdateClient(state.clients, id, changes) })),

  deleteClient: (id) =>
    set((state) => ({ clients: svcDeleteClient(state.clients, id) })),

  addClientNote: (clientId, content) =>
    set((state) => ({ clients: svcAddNote(state.clients, clientId, content) })),

  deleteClientNote: (clientId, noteId) =>
    set((state) => ({ clients: svcDeleteNote(state.clients, clientId, noteId) })),

  editClientNote: (clientId, noteId, content) =>
    set((state) => ({ clients: svcEditNote(state.clients, clientId, noteId, content) })),

  // ── Group Scheduling ────────────────────────────────────────────────────────
  fetchGroupClasses: () => {
    const storedClasses = loadGroupClasses();
    const storedEnrollments = loadEnrollments();
    if (USE_MOCK && storedClasses.length === 0) {
      saveGroupClasses(MOCK_GROUP_CLASSES);
      saveEnrollments(MOCK_ENROLLMENTS);
      set({ groupClasses: MOCK_GROUP_CLASSES, enrollments: MOCK_ENROLLMENTS });
    } else {
      set({
        groupClasses: storedClasses.length > 0 ? storedClasses : USE_MOCK ? MOCK_GROUP_CLASSES : storedClasses,
        enrollments: storedEnrollments.length > 0 ? storedEnrollments : USE_MOCK ? MOCK_ENROLLMENTS : storedEnrollments,
      });
    }
  },

  addGroupClass: (data) =>
    set((state) => ({ groupClasses: svcAddGroupClass(state.groupClasses, data) })),

  updateGroupClass: (id, changes) =>
    set((state) => ({ groupClasses: svcUpdateGroupClass(state.groupClasses, id, changes) })),

  deleteGroupClass: (id) =>
    set((state) => ({
      groupClasses: svcDeleteGroupClass(state.groupClasses, id),
      enrollments: state.enrollments.filter((e) => e.classId !== id),
    })),

  enrollClient: (classId, clientId, clientName, clientEmail) =>
    set((state) => {
      const result = svcEnrollClient(state.enrollments, state.groupClasses, classId, clientId, clientName, clientEmail);
      return { enrollments: result.enrollments, groupClasses: result.classes };
    }),

  unenrollClient: (enrollmentId) =>
    set((state) => {
      const result = svcUnenrollClient(state.enrollments, state.groupClasses, enrollmentId);
      return { enrollments: result.enrollments, groupClasses: result.classes };
    }),

  // ── Bookings ───────────────────────────────────────────────────────────────
  fetchBookings: async () => {
    set({ loading: true, error: null });
    try {
      if (USE_MOCK) {
        set({ bookings: MOCK_BOOKINGS, loading: false });
        return;
      }
      const result = await bookingService.getAll();
      set({ bookings: result.data, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  addBooking: (booking) =>
    set((state) => ({ bookings: [booking, ...state.bookings] })),

  updateBookingStatus: async (id, status) => {
    try {
      if (USE_MOCK) {
        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === id ? { ...b, status, updatedAt: new Date().toISOString() } : b,
          ),
        }));
        return;
      }
      const updated = await bookingService.updateStatus(id, status);
      set((state) => ({
        bookings: state.bookings.map((b) => (b.id === updated.id ? updated : b)),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  removeBooking: async (id) => {
    try {
      if (!USE_MOCK) await bookingService.cancel(id);
      set((state) => ({ bookings: state.bookings.filter((b) => b.id !== id) }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  // ── Slots ──────────────────────────────────────────────────────────────────
  fetchSlots: async (date) => {
    set({ loading: true, error: null });
    try {
      if (USE_MOCK) {
        const filtered = date
          ? MOCK_SLOTS.filter((s) => s.date === date)
          : MOCK_SLOTS;
        set({ slots: filtered, loading: false });
        return;
      }
      const data = date
        ? await slotService.getByDate(date)
        : await slotService.getRange('', '');
      set({ slots: data, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  addSlot: (slot) =>
    set((state) => ({ slots: [slot, ...state.slots] })),

  removeSlot: async (id) => {
    try {
      if (!USE_MOCK) await slotService.delete(id);
      set((state) => ({ slots: state.slots.filter((s) => s.id !== id) }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  // ── Services ───────────────────────────────────────────────────────────────
  fetchServices: async () => {
    set({ loading: true, error: null });
    try {
      if (USE_MOCK) {
        set({ services: MOCK_SERVICES, loading: false });
        return;
      }
      const data = await serviceService.getAll();
      set({ services: data, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  // ── Reschedule ─────────────────────────────────────────────────────────────
  rescheduleBooking: async (bookingId, newSlotId) => {
    try {
      const newSlot = useBookingStore.getState().slots.find((s) => s.id === newSlotId);
      if (USE_MOCK) {
        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === bookingId
              ? { ...b, slotId: newSlotId, slot: newSlot ?? b.slot, rescheduleCount: (b.rescheduleCount ?? 0) + 1, updatedAt: new Date().toISOString() }
              : b,
          ),
          slots: state.slots.map((s) => {
            if (s.id === newSlotId) return { ...s, booked: s.booked + 1, available: s.booked + 1 < s.capacity };
            const oldBooking = state.bookings.find((bk) => bk.id === bookingId);
            if (oldBooking && s.id === oldBooking.slotId) return { ...s, booked: Math.max(0, s.booked - 1), available: true };
            return s;
          }),
        }));
        return;
      }
      await bookingService.updateStatus(bookingId, 'confirmed'); // placeholder — swap for real reschedule endpoint
      set((state) => ({
        bookings: state.bookings.map((b) =>
          b.id === bookingId ? { ...b, slotId: newSlotId, slot: newSlot ?? b.slot } : b,
        ),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  // ── Calendar sync ───────────────────────────────────────────────────────────
  fetchExternalEvents: async () => {
    try {
      const events = await calendarSyncService.getExternalEvents();
      set({ externalEvents: events });
    } catch {
      // non-fatal — calendar sync failing shouldn't break the app
    }
  },

  // ── Reminders ───────────────────────────────────────────────────────────────
  fetchAllReminders: async () => {
    set({ loading: true, error: null });
    try {
      if (USE_MOCK) {
        set({ allReminders: buildMockAllReminders(), loading: false });
        return;
      }
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  resendReminder: async (reminderId) => {
    try {
      await new Promise((r) => setTimeout(r, 600));
      if (!USE_MOCK) await reminderService.resend(reminderId);
      set((state) => ({
        allReminders: state.allReminders.map((r) =>
          r.id === reminderId
            ? { ...r, status: 'sent' as const, sentAt: new Date().toISOString() }
            : r,
        ),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  cancelReminder: async (reminderId) => {
    try {
      if (!USE_MOCK) await reminderService.cancel(reminderId);
      set((state) => ({
        allReminders: state.allReminders.filter((r) => r.id !== reminderId),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  sendReminderNow: async (bookingId, channel) => {
    try {
      await new Promise((r) => setTimeout(r, 800));
      const newReminder: ScheduledReminder = {
        id: `rm-now-${Date.now()}`,
        bookingId,
        channel,
        timing: '2h',
        scheduledFor: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        status: 'sent',
      };
      set((state) => ({ allReminders: [newReminder, ...state.allReminders] }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  clearError: () => set({ error: null }),

  // ── Timezones ──────────────────────────────────────────────────────────────
  setClientTimezone: (tz) => set({ clientTimezone: tz }),
  setProviderTimezone: (tz) => {
    localStorage.setItem(PROVIDER_TZ_KEY, tz);
    set({ providerTimezone: tz });
  },

  setPolicy: (policy) => {
    savePolicy(policy);
    set({ policy });
  },
}));
