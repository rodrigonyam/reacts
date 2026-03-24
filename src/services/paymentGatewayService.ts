/**
 * paymentGatewayService — manages multi-gateway payment settings and mock
 * payment execution for Stripe, PayPal, and Square.
 *
 * Settings are persisted to localStorage under 'sos_payment_gateway_settings'.
 * In dev/mock mode all gateways simulate charges without real API calls.
 */
import type { PaymentGatewaySettings, PaymentGateway, PaymentInfo } from '../types';

const STORAGE_KEY = 'sos_payment_gateway_settings';

export const DEFAULT_GATEWAY_SETTINGS: PaymentGatewaySettings = {
  defaultGateway: 'stripe',
  gateways: {
    stripe: { enabled: true,  testMode: true, publishableKey: '' },
    paypal: { enabled: false, testMode: true, clientId: '' },
    square: { enabled: false, testMode: true, applicationId: '', locationId: '' },
  },
  depositEnabled: false,
  depositType: 'percent',
  depositValue: 50,
};

export function loadGatewaySettings(): PaymentGatewaySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GATEWAY_SETTINGS;
    const saved = JSON.parse(raw) as Partial<PaymentGatewaySettings>;
    return {
      ...DEFAULT_GATEWAY_SETTINGS,
      ...saved,
      gateways: {
        ...DEFAULT_GATEWAY_SETTINGS.gateways,
        ...(saved.gateways ?? {}),
      },
    };
  } catch {
    return DEFAULT_GATEWAY_SETTINGS;
  }
}

export function saveGatewaySettings(settings: PaymentGatewaySettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Returns how many cents to charge now given total cents and deposit policy. */
export function calculateDepositAmount(
  totalCents: number,
  settings: PaymentGatewaySettings,
): number {
  if (!settings.depositEnabled) return totalCents;
  if (settings.depositType === 'fixed') {
    return Math.min(settings.depositValue, totalCents);
  }
  // percent
  return Math.round((totalCents * settings.depositValue) / 100);
}

/** Returns the gateways that are currently enabled in settings. */
export function getEnabledGateways(settings: PaymentGatewaySettings): PaymentGateway[] {
  return (['stripe', 'paypal', 'square'] as PaymentGateway[]).filter(
    (g) => settings.gateways[g].enabled,
  );
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

/** Simulates a PayPal checkout redirect-and-return flow */
export function mockPayPalCheckout(amountCents: number): Promise<PaymentInfo> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: 'paid',
        amount: amountCents,
        currency: 'usd',
        gateway: 'paypal',
        intentId: `pp_mock_${Date.now()}`,
        paidAt: new Date().toISOString(),
        brand: 'PayPal',
      });
    }, 1800);
  });
}

/** Simulates a Square card-entry payment */
export function mockSquarePayment(
  amountCents: number,
  cardNumber: string,
): Promise<PaymentInfo> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (cardNumber.replace(/\s/g, '').startsWith('4000000000000002')) {
        reject(new Error('Your card was declined.'));
        return;
      }
      const last4 = cardNumber.replace(/\s/g, '').slice(-4);
      resolve({
        status: 'paid',
        amount: amountCents,
        currency: 'usd',
        gateway: 'square',
        intentId: `sq_mock_${Date.now()}`,
        paidAt: new Date().toISOString(),
        last4,
        brand: 'Square',
      });
    }, 1600);
  });
}
