'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { Card } from '@/components/Card';
import { ProfilePanel } from '@/components/ProfilePanel';

export default function ProfilePage() {
  const { user, configured, signOut } = useAuth();
  const { features, saveProfile } = useProfile();
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const onSaveProfile = async () => {
    await saveProfile();
    setSavedNote('Profile saved to your account.');
    setTimeout(() => setSavedNote(null), 3000);
  };

  return (
    <>
      <Card title="Account">
        {configured && user ? (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text">{user.email}</p>
              <p className="text-xs text-muted">Signed in</p>
            </div>
            <button onClick={() => signOut()}
              className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-text hover:border-signal/50">
              Sign out
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted">
            You’re not signed in. <Link href="/login" className="font-medium text-signal">Sign in</Link>
          </p>
        )}
      </Card>

      <Card title="Rider profile"
        action={<button onClick={onSaveProfile} className="text-xs font-medium text-signal">Save</button>}>
        <p className="mb-3 text-sm text-muted">
          Age {features.Biker_Age}, {features.Riding_Experience} yrs riding. These personal details
          can’t be sensed automatically — set them once and they’re saved to your account.
        </p>
        <ProfilePanel />
        {savedNote && <p className="mt-3 text-xs text-risk-low">{savedNote}</p>}
      </Card>

      <Card title="More">
        <div className="flex flex-col gap-2 text-sm">
          <Link href="/history" className="font-medium text-signal">My trip history →</Link>
          <Link href="/about" className="font-medium text-signal">About RideGuard & how the score works →</Link>
        </div>
      </Card>
    </>
  );
}
