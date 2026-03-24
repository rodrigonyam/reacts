/**
 * ReminderSettings — lets the client configure which automated reminders
 * they want to receive (email, SMS, or both) and when (timing before appt).
 */
import type { ReminderChannel, ReminderConfig, ReminderTiming } from '../../types';
import { timingLabel } from '../../services/reminderService';

interface ReminderSettingsProps {
  value: ReminderConfig;
  onChange: (config: ReminderConfig) => void;
}

const TIMINGS: ReminderTiming[] = ['1week', '24h', '2h', '30min'];

export function ReminderSettings({ value, onChange }: ReminderSettingsProps) {
  const toggleEnabled = () => onChange({ ...value, enabled: !value.enabled });

  const setChannel = (channel: ReminderChannel) => onChange({ ...value, channels: channel });

  const toggleTiming = (timing: ReminderTiming) => {
    const has = value.timings.includes(timing);
    onChange({
      ...value,
      timings: has ? value.timings.filter((t) => t !== timing) : [...value.timings, timing],
    });
  };

  const checkboxCls = 'h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 cursor-pointer';
  const radioCls = 'h-4 w-4 border-gray-300 text-sky-600 focus:ring-sky-500 cursor-pointer';

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
      {/* Enable toggle */}
      <label className="flex cursor-pointer items-center gap-3">
        <span className="relative inline-block">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={value.enabled}
            onChange={toggleEnabled}
          />
          <span className="block h-6 w-11 rounded-full bg-gray-300 peer-checked:bg-sky-500 transition-colors" />
          <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        </span>
        <span className="text-sm font-medium text-gray-800">
          {value.enabled ? 'Reminders enabled' : 'Enable reminders'}
        </span>
      </label>

      {value.enabled && (
        <>
          {/* Channel selection */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Notify via
            </p>
            <div className="flex gap-6">
              {(['email', 'sms', 'both'] as ReminderChannel[]).map((ch) => (
                <label key={ch} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="radio"
                    className={radioCls}
                    checked={value.channels === ch}
                    onChange={() => setChannel(ch)}
                  />
                  <span className="capitalize">
                    {ch === 'email' ? '✉️ Email' : ch === 'sms' ? '📱 SMS' : '✉️📱 Both'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Timing selection */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Send reminder
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TIMINGS.map((timing) => (
                <label
                  key={timing}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    value.timings.includes(timing)
                      ? 'border-sky-400 bg-sky-50 text-sky-700 font-medium'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className={checkboxCls}
                    checked={value.timings.includes(timing)}
                    onChange={() => toggleTiming(timing)}
                  />
                  {timingLabel(timing)}
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
