/**
 * Reschedule service — generates and validates reschedule tokens.
 * Clients receive a link /reschedule/<token> via their confirmation email.
 * In mock mode the token is generated client-side.
 */
import api from './api';
import type { RescheduleToken, Booking } from '../types';

export const rescheduleService = {
  /** Ask the backend to generate a reschedule token for a booking */
  createToken: async (bookingId: string): Promise<RescheduleToken> => {
    const { data } = await api.post<RescheduleToken>(`/reschedule/token`, { bookingId });
    return data;
  },

  /** Validate a token and return the associated booking */
  validateToken: async (token: string): Promise<{ booking: Booking; rescheduleToken: RescheduleToken }> => {
    const { data } = await api.get(`/reschedule/validate/${token}`);
    return data;
  },

  /** Submit the new slot for a rescheduled booking */
  reschedule: async (token: string, newSlotId: string): Promise<Booking> => {
    const { data } = await api.post<Booking>(`/reschedule/confirm`, { token, newSlotId });
    return data;
  },
};

/** Generate a mock reschedule token (frontend only) */
export function mockGenerateToken(bookingId: string): RescheduleToken {
  return {
    token: btoa(`${bookingId}:${Date.now()}`).replace(/=/g, ''),
    bookingId,
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    used: false,
  };
}
