/**
 * Reminder service — schedules and tracks email/SMS reminders.
 * In mock mode reminders are stored in memory and shown in the UI.
 * In production they are created via /api/reminders on your backend,
 * which integrates with SendGrid (email) and Twilio (SMS).
 */
import { api } from './api';
import type { ScheduledReminder, ReminderConfig, ReminderTiming, ReminderChannel } from '../types';
import { addHours, addMinutes, addWeeks, parseISO } from 'date-fns';

export const reminderService = {
  /** Schedule reminders for a booking */
  schedule: async (bookingId: string, config: ReminderConfig): Promise<ScheduledReminder[]> => {
    const { data } = await api.post<ScheduledReminder[]>(`/reminders/${bookingId}`, config);
    return data;
  },

  /** Get all reminders for a booking */
  getForBooking: async (bookingId: string): Promise<ScheduledReminder[]> => {
    const { data } = await api.get<ScheduledReminder[]>(`/reminders/${bookingId}`);
    return data;
  },

  /** Cancel a specific reminder */
  cancel: async (reminderId: string): Promise<void> => {
    await api.delete(`/reminders/${reminderId}`);
  },

  /** Cancel all reminders for a booking (e.g. on cancellation) */
  cancelAll: async (bookingId: string): Promise<void> => {
    await api.delete(`/reminders/booking/${bookingId}`);
  },
};

// ── Mock reminder generation ──────────────────────────────────────────────────

function offsetFromTiming(appointmentTime: Date, timing: ReminderTiming): Date {
  switch (timing) {
    case '1week':  return addWeeks(appointmentTime, -1);
    case '24h':    return addHours(appointmentTime, -24);
    case '2h':     return addHours(appointmentTime, -2);
    case '30min':  return addMinutes(appointmentTime, -30);
  }
}

export function buildMockReminders(
  bookingId: string,
  appointmentIso: string,
  config: ReminderConfig,
): ScheduledReminder[] {
  const apptTime = parseISO(appointmentIso);
  const channels: Array<'email' | 'sms'> =
    config.channels === 'both' ? ['email', 'sms'] :
    config.channels === 'email' ? ['email'] : ['sms'];

  const reminders: ScheduledReminder[] = [];
  config.timings.forEach((timing) => {
    channels.forEach((channel) => {
      reminders.push({
        id: `rm-${Date.now()}-${timing}-${channel}`,
        bookingId,
        channel,
        timing,
        scheduledFor: offsetFromTiming(apptTime, timing).toISOString(),
        status: 'pending',
      });
    });
  });
  return reminders;
}

/** Human-readable label for a timing value */
export function timingLabel(timing: ReminderTiming): string {
  switch (timing) {
    case '1week':  return '1 week before';
    case '24h':    return '24 hours before';
    case '2h':     return '2 hours before';
    case '30min':  return '30 minutes before';
  }
}

/** Channel icon */
export function channelIcon(channel: ReminderChannel): string {
  switch (channel) {
    case 'email': return '✉️';
    case 'sms':   return '📱';
    case 'both':  return '✉️📱';
  }
}
