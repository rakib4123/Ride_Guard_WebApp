'use client';

import { useProfile } from '@/context/ProfileContext';
import { useT } from '@/i18n/LocaleContext';
import type { MessageKey } from '@/i18n/messages/en';
import { OCCUPATIONS, EDUCATION_LEVELS, OWNERSHIPS } from '@rideguard/shared';
import { Field, NumberInput, Select } from './Field';

/** Slow-changing rider profile (model schema). Set once, reused. */
export function ProfilePanel() {
  const { profile, setProfile } = useProfile();
  const t = useT();
  const opt = (v: string) => t(`opt.${v}` as MessageKey);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={t('field.age')}>
        <NumberInput value={profile.Biker_Age} min={15} max={70}
          onChange={(v) => setProfile({ Biker_Age: v })} />
      </Field>
      <Field label={t('field.experience')}>
        <NumberInput value={profile.Riding_Experience} min={0} max={30}
          onChange={(v) => setProfile({ Riding_Experience: v })} />
      </Field>
      <Field label={t('field.occupation')}>
        <Select value={profile.Biker_Occupation} options={OCCUPATIONS} labelOf={opt}
          onChange={(v) => setProfile({ Biker_Occupation: v })} />
      </Field>
      <Field label={t('field.education')}>
        <Select value={profile.Biker_Education_Level} options={EDUCATION_LEVELS} labelOf={opt}
          onChange={(v) => setProfile({ Biker_Education_Level: v })} />
      </Field>
      <Field label={t('field.distance')}>
        <NumberInput value={profile.Daily_Travel_Distance} min={0} max={150}
          onChange={(v) => setProfile({ Daily_Travel_Distance: v })} />
      </Field>
      <Field label={t('field.ownership')}>
        <Select value={profile.Motorcycle_Ownership} options={OWNERSHIPS} labelOf={opt}
          onChange={(v) => setProfile({ Motorcycle_Ownership: v })} />
      </Field>
    </div>
  );
}
