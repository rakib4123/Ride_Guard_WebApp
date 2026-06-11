'use client';

import { useProfile } from '@/context/ProfileContext';
import {
  FREQUENCIES, ROAD_TYPES, ROAD_CONDITIONS, SPEED_LIMITS, TRAFFIC_LEVELS,
} from '@rideguard/shared';
import { Field, Lamp, NumberInput, Select } from './Field';

/** Per-trip conditions (model schema). Riders set these quickly. */
export function TripTogglesPanel() {
  const { toggles, setToggles } = useProfile();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Lamp label="Helmet" on={toggles.Wearing_Helmet === 'Yes'}
          onToggle={() => setToggles({ Wearing_Helmet: toggles.Wearing_Helmet === 'Yes' ? 'No' : 'Yes' })} />
        <Lamp label="Alcohol" danger on={toggles.Biker_Alcohol === 1}
          onToggle={() => setToggles({ Biker_Alcohol: toggles.Biker_Alcohol === 1 ? 0 : 1 })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone use">
          <Select value={toggles.Talk_While_Riding} options={FREQUENCIES}
            onChange={(v) => setToggles({ Talk_While_Riding: v })} />
        </Field>
        <Field label="Smoking">
          <Select value={toggles.Smoke_While_Riding} options={FREQUENCIES}
            onChange={(v) => setToggles({ Smoke_While_Riding: v })} />
        </Field>
        <Field label="Road type">
          <Select value={toggles.Road_Type} options={ROAD_TYPES}
            onChange={(v) => setToggles({ Road_Type: v })} />
        </Field>
        <Field label="Road condition">
          <Select value={toggles.Road_condition} options={ROAD_CONDITIONS}
            onChange={(v) => setToggles({ Road_condition: v })} />
        </Field>
        <Field label="Traffic density (1–8)">
          <Select value={toggles.Traffic_Density} options={TRAFFIC_LEVELS}
            onChange={(v) => setToggles({ Traffic_Density: v })} />
        </Field>
        <Field label="Speed limit">
          <Select value={toggles.Speed_Limit} options={SPEED_LIMITS}
            onChange={(v) => setToggles({ Speed_Limit: v })} />
        </Field>
        <Field label="Your speed (km/h)">
          <NumberInput value={toggles.Bike_Speed} min={0} max={300}
            onChange={(v) => setToggles({ Bike_Speed: v })} />
        </Field>
      </div>
    </div>
  );
}
