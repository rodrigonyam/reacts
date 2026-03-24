import { create } from 'zustand';
import type { Booking, TimeSlot, Service, BookingStatus } from '../types';
import { bookingService } from '../services/bookingService';
import { slotService } from '../services/slotService';
import { serviceService } from '../services/serviceService';
import {
  MOCK_BOOKINGS,
  MOCK_SLOTS,
  MOCK_SERVICES,
} from '../services/mockData';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.DEV;

interface BookingStore {
  bookings: Booking[];
  slots: TimeSlot[];
  services: Service[];
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

  // Utilities
  clearError: () => void;
}

export const useBookingStore = create<BookingStore>((set) => ({
  bookings: [],
  slots: [],
  services: [],
  loading: false,
  error: null,

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
              ? { ...b, slotId: newSlotId, slot: newSlot ?? b.slot, updatedAt: new Date().toISOString() }
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

  clearError: () => set({ error: null }),
}));
