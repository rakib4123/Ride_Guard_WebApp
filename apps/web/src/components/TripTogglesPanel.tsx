'use client';

import { useProfile } from '@/context/ProfileContext';
import { useT } from '@/i18n/LocaleContext';
import type { MessageKey } from '@/i18n/messages/en';
import {
  FREQUENCIES, ROAD_TYPES, ROAD_CONDITIONS, SPEED_LIMITS, TRAFFIC_LEVELS,
} from '@rideguard/shared';
import { Field, Lamp, NumberInput, Select } from './Field';

/** Per-trip conditions (model schema). Riders set these quickly. */
export function TripTogglesPanel() {
  const { toggles, setToggles } = useProfile();
  const t = useT();
  const opt = (v: string) => t(`opt.${v}` as MessageKey);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Lamp label={t('field.helmet')} on={toggles.Wearing_Helmet === 'Yes'}
          onToggle={() => setToggles({ Wearing_Helmet: toggles.Wearing_Helmet === 'Yes' ? 'No' : 'Yes' })} />
        <Lamp label={t('field.alcohol')} danger on={toggles.Biker_Alcohol === 1}
          onToggle={() => setToggles({ Biker_Alcohol: toggles.Biker_Alcohol === 1 ? 0 : 1 })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('field.phone')}>
          <Select value={toggles.Talk_While_Riding} options={FREQUENCIES} labelOf={opt}
            onChange={(v) => setToggles({ Talk_While_Riding: v })} />
        </Field>
        <Field label={t('field.smoking')}>
          <Select value={toggles.Smoke_While_Riding} options={FREQUENCIES} labelOf={opt}
            onChange={(v) => setToggles({ Smoke_While_Riding: v })} />
        </Field>
        <Field label={t('field.roadType')}>
          <Select value={toggles.Road_Type} options={ROAD_TYPES} labelOf={opt}
            onChange={(v) => setToggles({ Road_Type: v })} />
        </Field>
        <Field label={t('field.roadCondition')}>
          <Select value={toggles.Road_condition} options={ROAD_CONDITIONS} labelOf={opt}
            onChange={(v) => setToggles({ Road_condition: v })} />
        </Field>
        <Field label={t('field.traffic')}>
          <Select value={toggles.Traffic_Density} options={TRAFFIC_LEVELS}
            onChange={(v) => setToggles({ Traffic_Density: v })} />
        </Field>
        <Field label={t('field.speedLimit')}>
          <Select value={toggles.Speed_Limit} options={SPEED_LIMITS}
            onChange={(v) => setToggles({ Speed_Limit: v })} />
        </Field>
        <Field label={t('field.speed')}>
          <NumberInput value={toggles.Bike_Speed} min={0} max={300}
            onChange={(v) => setToggles({ Bike_Speed: v })} />
        </Field>
      </div>
    </div>
  );
}
