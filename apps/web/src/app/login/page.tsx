'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { Card } from '@/components/Card';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) { setErr('Auth is not configured yet.'); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) setErr(error.message);
    else router.replace('/now');
  };

  return (
    <Card>
      <h1 className="text-xl font-semibold text-text">Welcome back</h1>
      <p className="mb-4 mt-1 text-sm text-muted">Sign in to RideGuard.</p>
      {!supabaseConfigured && (
        <p className="mb-3 rounded-lg bg-risk-high/10 px-3 py-2 text-xs text-risk-high">
          Supabase isn’t configured. Set NEXT_PUBLIC_SUPABASE_URL and _ANON_KEY in Vercel.
        </p>
      )}
      <form onSubmit={submit} className="space-y-3">
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field label="Password" type="password" value={pw} onChange={setPw} autoComplete="current-password" />
        {err && <p className="text-xs text-risk-high">{err}</p>}
        <button type="submit" disabled={busy}
          className="w-full rounded-xl bg-signal py-3 text-sm font-semibold text-ink shadow-soft disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        New here? <Link href="/signup" className="font-medium text-signal">Create an account</Link>
      </p>
    </Card>
  );
}

function Field({ label, type, value, onChange, autoComplete }: {
  label: string; type: string; value: string; onChange: (v: string) => void; autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input type={type} value={value} autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)} required
        className="w-full rounded-xl border border-line bg-panel2 px-3 py-2.5 text-sm text-text outline-none focus:border-signal" />
    </label>
  );
}
