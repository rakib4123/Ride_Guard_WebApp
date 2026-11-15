'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/i18n/LocaleContext';
import { useCrowdSettings } from '@/lib/crowdSettings';
import { bleScanSupported } from '@/lib/bleScan';
import { Lamp } from '@/components/Field';

/** The two D2D opt-ins. Shown on Now (details) and Profile. */
export function CrowdSettingsPanel() {
  const t = useT();
  const [settings, setSettings] = useCrowdSettings();
  // navigator is only available after mount.
  const [canScan, setCanScan] = useState(false);
  useEffect(() => setCanScan(bleScanSupported()), []);
  return (
    <div className="space-y-2">
      <Lamp label={t('crowd.share')} on={settings.share}
        onToggle={() => setSettings({ ...settings, share: !settings.share })} />
      {canScan ? (
        <Lamp label={t('crowd.scan')} on={settings.scan}
          onToggle={() => setSettings({ ...settings, scan: !settings.scan })} />
      ) : (
        <p className="text-xs text-muted">{t('crowd.bleOff')}</p>
      )}
    </div>
  );
}
