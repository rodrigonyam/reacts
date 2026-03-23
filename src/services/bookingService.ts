import api from './api';
import type { Booking, BookingFormData, BookingStatus, PaginatedResponse } from '../types';

export const bookingService = {
  /** Fetch all bookings (paginated) */
  getAll: async (page = 1, limit = 20) => {
    const { data } = await api.get<PaginatedResponse<Booking>>('/bookings', {
      params: { page, limit },
    });
    return data;
  },

  /** Fetch a single booking by ID */
  getById: async (id: string) => {
    const { data } = await api.get<{ data: Booking }>(`/bookings/${id}`);
    return data.data;
  },

  /** Create a new booking from the booking form */
  create: async (payload: BookingFormData) => {
    const { data } = await api.post<{ data: Booking }>('/bookings', payload);
    return data.data;
  },

  /** Update booking status */
  updateStatus: async (id: string, status: BookingStatus) => {
    const { data } = await api.patch<{ data: Booking }>(`/bookings/${id}/status`, { status });
    return data.data;
  },

  /** Cancel a booking */
  cancel: async (id: string) => {
    const { data } = await api.delete<{ data: Booking }>(`/bookings/${id}`);
    return data.data;
  },
};
