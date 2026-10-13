'use client';

import { useAlerts, type Channels } from '@/context/AlertsContext';
import { useT } from '@/i18n/LocaleContext';
import type { MessageKey } from '@/i18n/messages/en';

const CHANNELS: { key: keyof Channels; label: MessageKey }[] = [
  { key: 'sound', label: 'alerts.sound' },
  { key: 'voice', label: 'alerts.voice' },
  { key: 'vibrate', label: 'alerts.vibrate' },
];

/**
 * Alert channels as full-width labelled switches, plus "Test alert now"
 * (spec 7.2). Browsers block audio until a user gesture, so a rider must be
 * able to confirm alerts work while parked rather than find out mid-ride.
 */
export function AlertSettings() {
  const t = useT();
  const { channels, setChannels, arm, fire } = useAlerts();
  return (
    <div className="space-y-2">
      {CHANNELS.map(({ key, label }) => (
        <button key={key} type="button" role="switch" aria-checked={channels[key]}
          onClick={() => setChannels({ ...channels, [key]: !channels[key] })}
          className="flex min-h-12 w-full items-center justify-between rounded-xl border border-line bg-panel2 px-4 text-sm font-medium text-text">
          {t(label)}
          <span className={`relative h-6 w-11 rounded-full transition-colors ${channels[key] ? 'bg-signal' : 'bg-line'}`} aria-hidden="true">
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-all ${channels[key] ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
        </button>
      ))}
      <button type="button"
        onClick={() => { arm(); fire('test', t('alert.test'), 'med'); }}
        className="flex min-h-12 w-full items-center justify-center rounded-xl border border-signal/40 bg-signal/5 text-sm font-semibold text-signal">
        {t('alerts.test')}
      </button>
    </div>
  );
}
