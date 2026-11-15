'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/i18n/LocaleContext';
import { Card } from '@/components/Card';
import { CrowdSettingsPanel } from '@/components/CrowdSettingsPanel';
import { LanguageToggle } from '@/components/LanguageToggle';
import { AlertSettings } from '@/components/AlertSettings';

/** Profile: Alerts, People around you, Language, limits, then Account. Nothing here feeds the score. */
export default function ProfilePage() {
  const { locale, t } = useLocale();
  const { user, configured, signOut } = useAuth();
  return (
    <>
      <Card title={t('profile.alerts')}>
        <p className="mb-3 text-sm text-muted">{t('profile.alertsHelp')}</p>
        <AlertSettings />
      </Card>

      <Card title={t('crowd.title')}>
        <p className="mb-3 text-sm text-muted">{t('crowd.help')}</p>
        <CrowdSettingsPanel />
      </Card>

      {/* Always both words, so a rider in the wrong language can find this. */}
      <Card title={locale === 'bn' ? 'ভাষা · Language' : 'Language · ভাষা'}>
        <LanguageToggle />
      </Card>


      {/* A standing caution, not a buried link. */}
      <section className="rounded-xl2 border border-risk-med/40 bg-risk-med/10 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
          <span aria-hidden="true">⚠︎</span> {t('profile.limits')}
        </h2>
        <p className="mt-1 text-sm text-text">{t('profile.limitsBody')}</p>
        <Link href="/about" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-signal">
          {t('profile.limitsLink')} →
        </Link>
      </section>

      <Card title={t('common.account')}>
        {configured && user ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text">{user.email}</p>
              <p className="text-xs text-muted">{t('profile.signedIn')}</p>
            </div>
            <button onClick={() => signOut()}
              className="min-h-11 rounded-xl border border-line px-4 text-sm font-medium text-text hover:border-signal/50">
              {t('profile.signOut')}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted">
            {t('profile.notSignedIn')} <Link href="/login" className="font-medium text-signal">{t('profile.signIn')}</Link>
          </p>
        )}
      </Card>
    </>
  );
}
