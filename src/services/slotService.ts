import api from './api';
import type { TimeSlot, SlotFormData } from '../types';

export const slotService = {
  /** Get all available slots for a given date */
  getByDate: async (date: string) => {
    const { data } = await api.get<{ data: TimeSlot[] }>('/slots', {
      params: { date },
    });
    return data.data;
  },

  /** Get slots for a date range (used by calendar) */
  getRange: async (start: string, end: string) => {
    const { data } = await api.get<{ data: TimeSlot[] }>('/slots', {
      params: { start, end },
    });
    return data.data;
  },

  /** Create a new time slot */
  create: async (payload: SlotFormData) => {
    const { data } = await api.post<{ data: TimeSlot }>('/slots', payload);
    return data.data;
  },

  /** Update an existing slot */
  update: async (id: string, payload: Partial<SlotFormData>) => {
    const { data } = await api.put<{ data: TimeSlot }>(`/slots/${id}`, payload);
    return data.data;
  },

  /** Delete a slot */
  delete: async (id: string) => {
    await api.delete(`/slots/${id}`);
  },
};
