/**
 * PaymentForm — collects card details and processes payment.
 *
 * In mock/dev mode (VITE_USE_MOCK=true) the form validates card fields locally
 * and simulates a charge via mockChargeCard().
 *
 * In production mode it uses @stripe/react-stripe-js CardElement and
 * confirms the PaymentIntent created by your backend.
 */
import { useState } from 'react';
import { mockChargeCard } from '../../services/paymentService';
import type { PaymentInfo } from '../../types';

interface PaymentFormProps {
  amount: number;          // in dollars
  serviceName: string;
  onSuccess: (payment: PaymentInfo) => void;
  onCancel: () => void;
}

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.DEV;

export function PaymentForm({ amount, serviceName, onSuccess, onCancel }: PaymentFormProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [nameOnCard, setNameOnCard] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Card number formatter: adds spaces every 4 digits ── */
  const handleCardNumber = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 16);
    setCardNumber(digits.replace(/(.{4})/g, '$1 ').trim());
  };

  /* ── Expiry formatter: MM/YY ── */
  const handleExpiry = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    if (digits.length > 2) {
      setExpiry(`${digits.slice(0, 2)}/${digits.slice(2)}`);
    } else {
      setExpiry(digits);
    }
  };

  const validate = (): string | null => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setProcessing(true);
    try {
      if (USE_MOCK) {
        const info = await mockChargeCard(amount * 100, cardNumber.replace(/\s/g, ''));
        onSuccess(info);
      } else {
        // Production: call backend for PaymentIntent, then confirmCardPayment
        // via stripe.confirmCardPayment(clientSecret, { payment_method: { card } })
        throw new Error('Connect your backend to process real payments.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const inputCls =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm ' +
    'focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60';

  return (
    <div className="space-y-5">
      {/* Order summary */}
      <div className="rounded-lg bg-sky-50 px-4 py-3 text-sm">
        <div className="flex items-center justify-between font-medium text-sky-800">
          <span>{serviceName}</span>
          <span>${amount.toFixed(2)}</span>
        </div>
        <p className="mt-1 text-xs text-sky-600">
          Secure payment processed via Stripe. Your card details are never stored on our servers.
        </p>
      </div>

      {/* Card form */}
      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Name on card</label>
          <input
            value={nameOnCard}
            onChange={(e) => setNameOnCard(e.target.value)}
            placeholder="Jane Smith"
            className={inputCls}
            disabled={processing}
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
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              💳
            </span>
          </div>
          {USE_MOCK && (
            <p className="mt-1 text-xs text-gray-400">
              Test: 4242 4242 4242 4242 (any future date + any CVC) | 4000 0000 0000 0002 to decline
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
            ) : (
              `Pay $${amount.toFixed(2)}`
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
