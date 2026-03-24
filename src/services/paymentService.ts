/**
 * Payment service — wraps Stripe PaymentIntent creation and confirmation.
 * In mock mode (VITE_USE_MOCK=true) the charge is simulated client-side.
 * In production mode it calls /api/payments on your backend, which creates
 * the Stripe PaymentIntent and returns the clientSecret.
 */
import { api } from './api';
import type { PaymentInfo } from '../types';

export interface CreatePaymentIntentRequest {
  bookingId: string;
  amount: number;    // cents
  currency?: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  intentId: string;
}

export const paymentService = {
  /** Ask the backend to create a Stripe PaymentIntent */
  createIntent: async (req: CreatePaymentIntentRequest): Promise<PaymentIntentResponse> => {
    const { data } = await api.post<PaymentIntentResponse>('/payments/intent', req);
    return data;
  },

  /** Confirm payment after Stripe CardElement collects card details */
  confirmPayment: async (bookingId: string, intentId: string): Promise<PaymentInfo> => {
    const { data } = await api.post<PaymentInfo>('/payments/confirm', { bookingId, intentId });
    return data;
  },

  /** Fetch payment info for a booking */
  getPaymentInfo: async (bookingId: string): Promise<PaymentInfo> => {
    const { data } = await api.get<PaymentInfo>(`/payments/${bookingId}`);
    return data;
  },

  /** Issue a full or partial refund */
  refund: async (bookingId: string, amount?: number): Promise<PaymentInfo> => {
    const { data } = await api.post<PaymentInfo>(`/payments/${bookingId}/refund`, { amount });
    return data;
  },
};

// ── Mock helpers ──────────────────────────────────────────────────────────────

/** Simulates a successful Stripe charge without a real backend */
export function mockChargeCard(
  amount: number,
  cardNumber: string,
): Promise<PaymentInfo> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate a declined card
      if (cardNumber.startsWith('4000000000000002')) {
        reject(new Error('Your card was declined.'));
        return;
      }
      const last4 = cardNumber.replace(/\s/g, '').slice(-4);
      resolve({
        status: 'paid',
        amount,
        currency: 'usd',
        intentId: `pi_mock_${Date.now()}`,
        paidAt: new Date().toISOString(),
        last4,
        brand: 'visa',
      });
    }, 1400);
  });
}
