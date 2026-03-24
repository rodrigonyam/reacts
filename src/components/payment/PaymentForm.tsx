/**
 * PaymentForm — multi-gateway checkout with optional deposit support.
 *
 * Supports Stripe (card), PayPal (simulated redirect), and Square (card).
 * Respects gateway settings and deposit policy from paymentGatewayService.
 * In mock/dev mode all gateways simulate charges without real API calls.
 */
import { useState, useMemo } from 'react';
import { mockChargeCard } from '../../services/paymentService';
import {
  loadGatewaySettings,
  calculateDepositAmount,
  getEnabledGateways,
  mockPayPalCheckout,
  mockSquarePayment,
} from '../../services/paymentGatewayService';
import type { PaymentGateway, PaymentGatewaySettings, PaymentInfo } from '../../types';

interface PaymentFormProps {
  amount: number;          // in dollars (full service price)
  serviceName: string;
  onSuccess: (payment: PaymentInfo) => void;
  onCancel: () => void;
  paymentSettings?: PaymentGatewaySettings; // if omitted, loaded from localStorage
}

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.DEV;

const GATEWAY_LABELS: Record<PaymentGateway, { label: string; icon: string }> = {
  stripe:  { label: 'Credit / Debit Card', icon: '💳' },
  paypal:  { label: 'PayPal',              icon: '🅿️' },
  square:  { label: 'Square',              icon: '🔲' },
};

const inputCls =
  'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm ' +
  'focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60';

// ── Card form shared by Stripe and Square ────────────────────────────────────
function CardForm({
  processing,
  cardNumber,
  setCardNumber,
  expiry,
  setExpiry,
  cvc,
  setCvc,
  nameOnCard,
  setNameOnCard,
  gateway,
}: {
  processing: boolean;
  cardNumber: string;
  setCardNumber: (v: string) => void;
  expiry: string;
  setExpiry: (v: string) => void;
  cvc: string;
  setCvc: (v: string) => void;
  nameOnCard: string;
  setNameOnCard: (v: string) => void;
  gateway: 'stripe' | 'square';
}) {
  const handleCardNumber = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 16);
    setCardNumber(digits.replace(/(.{4})/g, '$1 ').trim());
  };

  const handleExpiry = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    if (digits.length > 2) {
      setExpiry(`${digits.slice(0, 2)}/${digits.slice(2)}`);
    } else {
      setExpiry(digits);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Name on card</label>
        <input
          value={nameOnCard}
          onChange={(e) => setNameOnCard(e.target.value)}
          placeholder="Jane Smith"
          className={inputCls}
          disabled={processing}
          autoComplete="off"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Card number</label>
        <div className="relative">
          <input
            value={cardNumber}
            onChange={(e) => handleCardNumber(e.target.value)}
            placeholder="4242 4242 4242 4242"
            maxLength={19}
            className={`${inputCls} pr-12 font-mono tracking-widest`}
            disabled={processing}
            inputMode="numeric"
            autoComplete="off"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {gateway === 'square' ? '🔲' : '💳'}
          </span>
        </div>
        {USE_MOCK && (
          <p className="mt-1 text-xs text-gray-400">
            Test: 4242 4242 4242 4242 (any future date + any CVC) · 4000 0000 0000 0002 to decline
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Expiry (MM/YY)</label>
          <input
            value={expiry}
            onChange={(e) => handleExpiry(e.target.value)}
            placeholder="12/27"
            maxLength={5}
            className={`${inputCls} font-mono`}
            disabled={processing}
            inputMode="numeric"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">CVC</label>
          <input
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="123"
            maxLength={4}
            className={`${inputCls} font-mono`}
            disabled={processing}
            inputMode="numeric"
            type="password"
          />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════════
export function PaymentForm({ amount, serviceName, onSuccess, onCancel, paymentSettings }: PaymentFormProps) {
  const settings = useMemo(
    () => paymentSettings ?? loadGatewaySettings(),
    [paymentSettings],
  );

  const enabledGateways = useMemo(() => getEnabledGateways(settings), [settings]);

  // Default active gateway — prefer settings.defaultGateway if enabled, else first enabled
  const initialGateway: PaymentGateway =
    settings.gateways[settings.defaultGateway]?.enabled
      ? settings.defaultGateway
      : (enabledGateways[0] ?? 'stripe');

  const [activeGateway, setActiveGateway] = useState<PaymentGateway>(initialGateway);

  // Deposit support
  const totalCents = Math.round(amount * 100);
  const depositCents = calculateDepositAmount(totalCents, settings);
  const isDepositAvailable = settings.depositEnabled && depositCents < totalCents;
  const [payDeposit, setPayDeposit] = useState(false);

  const chargeCents = payDeposit ? depositCents : totalCents;
  const chargeAmount = chargeCents / 100; // dollars for display

  // Card fields (shared by Stripe + Square)
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [nameOnCard, setNameOnCard] = useState('');

  // PayPal email
  const [paypalEmail, setPaypalEmail] = useState('');

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Card validation ────────────────────────────────────────────────────────
  const validateCard = (): string | null => {
    const rawCard = cardNumber.replace(/\s/g, '');
    if (rawCard.length < 16) return 'Enter a valid 16-digit card number.';
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return 'Enter expiry as MM/YY.';
    const [mm, yy] = expiry.split('/').map(Number);
    if (mm < 1 || mm > 12) return 'Invalid expiry month.';
    const nowYear = new Date().getFullYear() % 100;
    const nowMonth = new Date().getMonth() + 1;
    if (yy < nowYear || (yy === nowYear && mm < nowMonth)) return 'Your card has expired.';
    if (cvc.length < 3) return 'CVC must be 3 or 4 digits.';
    if (nameOnCard.trim().length < 2) return 'Enter the name on your card.';
    return null;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (activeGateway === 'stripe' || activeGateway === 'square') {
      const validationError = validateCard();
      if (validationError) { setError(validationError); return; }
    }

    setProcessing(true);
    try {
      let info: PaymentInfo;

      if (!USE_MOCK) {
        throw new Error('Connect your backend to process real payments.');
      }

      if (activeGateway === 'paypal') {
        info = await mockPayPalCheckout(chargeCents);
      } else if (activeGateway === 'square') {
        info = await mockSquarePayment(chargeCents, cardNumber.replace(/\s/g, ''));
      } else {
        // stripe
        info = await mockChargeCard(chargeCents, cardNumber.replace(/\s/g, ''));
        info = { ...info, gateway: 'stripe' };
      }

      // Attach deposit metadata
      if (payDeposit) {
        info = {
          ...info,
          paymentType: 'deposit',
          depositAmount: depositCents,
          remainingBalance: totalCents - depositCents,
        };
      } else {
        info = { ...info, paymentType: 'full' };
      }

      onSuccess(info);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const remainingDollars = ((totalCents - depositCents) / 100).toFixed(2);

  return (
    <div className="space-y-5">
      {/* Order summary */}
      <div className="rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 text-sm">
        <div className="flex items-center justify-between font-semibold text-sky-900">
          <span>{serviceName}</span>
          <span>${amount.toFixed(2)}</span>
        </div>
        {isDepositAvailable && payDeposit && (
          <div className="mt-2 border-t border-sky-200 pt-2 space-y-0.5 text-sky-700">
            <div className="flex justify-between text-xs">
              <span>Deposit due now</span>
              <span className="font-semibold">${chargeAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-sky-500">
              <span>Balance due at appointment</span>
              <span>${remainingDollars}</span>
            </div>
          </div>
        )}
      </div>

      {/* Deposit toggle */}
      {isDepositAvailable && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
            Payment Option
          </p>
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <button
              type="button"
              onClick={() => setPayDeposit(false)}
              className={`px-4 py-3 text-left text-sm transition-colors ${
                !payDeposit ? 'bg-sky-50 text-sky-800' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="font-semibold">${amount.toFixed(2)}</div>
              <div className="text-xs text-gray-500">Pay in full</div>
            </button>
            <button
              type="button"
              onClick={() => setPayDeposit(true)}
              className={`px-4 py-3 text-left text-sm transition-colors ${
                payDeposit ? 'bg-sky-50 text-sky-800' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="font-semibold">${chargeAmount.toFixed(2)}</div>
              <div className="text-xs text-gray-500">
                Deposit · ${remainingDollars} at appt.
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Gateway tabs */}
      {enabledGateways.length > 1 && (
        <div className="flex gap-2 border-b border-gray-200 pb-0">
          {enabledGateways.map((gw) => {
            const meta = GATEWAY_LABELS[gw];
            const active = gw === activeGateway;
            return (
              <button
                key={gw}
                type="button"
                onClick={() => { setActiveGateway(gw); setError(null); }}
                className={`flex items-center gap-1.5 rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium transition-colors -mb-px ${
                  active
                    ? 'border-gray-200 bg-white text-sky-700'
                    : 'border-transparent bg-gray-50 text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>{meta.icon}</span>
                {meta.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Gateway form */}
      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">

        {/* Stripe tab */}
        {activeGateway === 'stripe' && (
          <CardForm
            processing={processing}
            cardNumber={cardNumber}
            setCardNumber={setCardNumber}
            expiry={expiry}
            setExpiry={setExpiry}
            cvc={cvc}
            setCvc={setCvc}
            nameOnCard={nameOnCard}
            setNameOnCard={setNameOnCard}
            gateway="stripe"
          />
        )}

        {/* PayPal tab */}
        {activeGateway === 'paypal' && (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-dashed border-[#003087]/20 bg-[#003087]/5 p-5 text-center">
              <span className="text-4xl">🅿️</span>
              <p className="mt-2 text-sm font-semibold text-[#003087]">Pay with PayPal</p>
              <p className="mt-1 text-xs text-gray-500">
                You'll be redirected to PayPal to complete your payment securely.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                PayPal email <span className="text-xs font-normal text-gray-400">(for confirmation)</span>
              </label>
              <input
                type="email"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputCls}
                disabled={processing}
                autoComplete="email"
              />
            </div>
            {USE_MOCK && (
              <p className="text-xs text-gray-400">
                Demo: clicking "Pay" simulates a successful PayPal checkout.
              </p>
            )}
          </div>
        )}

        {/* Square tab */}
        {activeGateway === 'square' && (
          <CardForm
            processing={processing}
            cardNumber={cardNumber}
            setCardNumber={setCardNumber}
            expiry={expiry}
            setExpiry={setExpiry}
            cvc={cvc}
            setCvc={setCvc}
            nameOnCard={nameOnCard}
            setNameOnCard={setNameOnCard}
            gateway="square"
          />
        )}

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={processing}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60 transition-colors"
          >
            {processing ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing…
              </>
            ) : activeGateway === 'paypal' ? (
              `Pay $${chargeAmount.toFixed(2)} via PayPal`
            ) : (
              `Pay $${chargeAmount.toFixed(2)}`
            )}
          </button>
        </div>
      </form>

      {/* Security badge */}
      <p className="text-center text-xs text-gray-400">
        🔒 256-bit SSL encryption · PCI DSS compliant
      </p>
    </div>
  );
}

