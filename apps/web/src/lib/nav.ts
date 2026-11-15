/**
 * Where to go after signing in: the `next` query parameter when it is a safe
 * in-app path, else Now. Only same-site paths ("/history"), never "//evil.com"
 * or "https://..." — an open redirect would let a link bounce riders anywhere.
 */
export function nextPath(search: string | undefined = typeof window !== 'undefined' ? window.location.search : ''): string {
  const next = new URLSearchParams(search ?? '').get('next');
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/now';
}

/** A sign-in link that brings the rider back to `here` afterwards. */
export const signInHref = (here: string, page: 'login' | 'signup' = 'login') =>
  `/${page}?next=${encodeURIComponent(here)}`;
