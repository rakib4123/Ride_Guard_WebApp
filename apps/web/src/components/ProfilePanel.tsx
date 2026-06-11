'use client';

import { useProfile } from '@/context/ProfileContext';
import { OCCUPATIONS, EDUCATION_LEVELS, OWNERSHIPS } from '@rideguard/shared';
import { Field, NumberInput, Select } from './Field';

/** Slow-changing rider profile (model schema). Set once, reused. */
export function ProfilePanel() {
  const { profile, setProfile } = useProfile();
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Age">
        <NumberInput value={profile.Biker_Age} min={15} max={70}
          onChange={(v) => setProfile({ Biker_Age: v })} />
      </Field>
      <Field label="Experience (yrs)">
        <NumberInput value={profile.Riding_Experience} min={0} max={30}
          onChange={(v) => setProfile({ Riding_Experience: v })} />
      </Field>
      <Field label="Occupation">
        <Select value={profile.Biker_Occupation} options={OCCUPATIONS}
          onChange={(v) => setProfile({ Biker_Occupation: v })} />
      </Field>
      <Field label="Education">
        <Select value={profile.Biker_Education_Level} options={EDUCATION_LEVELS}
          onChange={(v) => setProfile({ Biker_Education_Level: v })} />
      </Field>
      <Field label="Daily distance (km)">
        <NumberInput value={profile.Daily_Travel_Distance} min={0} max={150}
          onChange={(v) => setProfile({ Daily_Travel_Distance: v })} />
      </Field>
      <Field label="Ownership">
        <Select value={profile.Motorcycle_Ownership} options={OWNERSHIPS}
          onChange={(v) => setProfile({ Motorcycle_Ownership: v })} />
      </Field>
    </div>
  );
}
