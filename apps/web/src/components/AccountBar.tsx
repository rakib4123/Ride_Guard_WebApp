'use client';

import { useAuth } from '@/context/AuthContext';

/** Compact account control shown in the header when signed in. */
export function AccountBar() {
  const { user, configured, signOut } = useAuth();
  if (!configured || !user) return null;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="hidden max-w-[150px] truncate text-muted sm:inline">{user.email}</span>
      <button
        onClick={() => signOut()}
        className="rounded-lg border border-line px-2.5 py-1 font-medium text-text hover:border-signal/50"
      >
        Sign out
      </button>
    </div>
  );
}
