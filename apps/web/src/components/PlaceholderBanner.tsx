import Link from 'next/link';

/** Always-present honest note (Handoff Section 11). Quiet, never dismissable. */
export function PlaceholderBanner() {
  return (
    <div className="border-b border-line bg-signal/[0.06] px-4 py-2 text-center text-xs text-signal">
      Advisory + data-collection tool, not a proven crash predictor.{' '}
      <Link href="/about" className="underline underline-offset-2">Why</Link>
    </div>
  );
}
