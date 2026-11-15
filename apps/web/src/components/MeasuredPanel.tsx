'use client';

import type { FeatureVector } from '@rideguard/shared';
import { useT } from '@/i18n/LocaleContext';
import type { MessageKey } from '@/i18n/messages/en';
import { inUnit, type SpeedUnit } from '@/lib/units';
import { CrowdSettingsPanel } from '@/components/CrowdSettingsPanel';

/**
 * What the model is scoring, read-only. Every value is measured by the phone;
 * there is nothing for the rider to fill in.
 */
export function MeasuredPanel({ features: f, unit }: { features: FeatureVector; unit: SpeedUnit }) {
  const t = useT();
  const u = t(unit === 'mph' ? 'ride.speedUnitMph' : 'ride.speedUnit');
  const opt = (v: string) => t(`opt.${v}` as MessageKey);
  const rows: [MessageKey, string][] = [
    ['field.speed', `${inUnit(f.Bike_Speed, unit)} ${u}`],
    ['field.speedLimit', `${inUnit(f.Speed_Limit, unit)} ${u}`],
    ['field.roadType', opt(f.Road_Type)],
    ['field.area', opt(f.Area)],
    ['field.weather', opt(f.Weather)],
    ['field.roadCondition', opt(f.Road_condition)],
    ['field.time', opt(f.Time_of_Day)],
    ['field.dark', f.Is_Dark ? t('opt.Yes') : t('opt.No')],
    ['field.traffic', String(f.Traffic_Density)],
    ['field.phone', f.Talk_While_Riding === 'Never' ? t('opt.No') : t('opt.Yes')],
  ];
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2 border-b border-line/60 py-1">
            <dt className="text-muted">{t(k)}</dt>
            <dd className="font-medium text-text tabular">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-line pt-3">
        <h3 className="mb-1 text-sm font-semibold text-text">{t('crowd.title')}</h3>
        <p className="mb-2 text-xs text-muted">{t('crowd.help')}</p>
        <CrowdSettingsPanel />
      </div>
    </div>
  );
}
