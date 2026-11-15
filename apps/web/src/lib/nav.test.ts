import { describe, it, expect } from 'vitest';
import { nextPath, signInHref } from '@/lib/nav';

describe('nextPath', () => {
  it('returns to the page that asked for sign-in', () => {
    expect(nextPath('?next=%2Fhistory')).toBe('/history');
  });

  it('defaults to Now', () => {
    expect(nextPath('')).toBe('/now');
  });

  it('never redirects off-site', () => {
    expect(nextPath('?next=https%3A%2F%2Fevil.com')).toBe('/now');
    expect(nextPath('?next=%2F%2Fevil.com')).toBe('/now');
    expect(nextPath('?next=%2F%5Cevil.com')).toBe('/now');
  });

  it('builds links that round-trip', () => {
    expect(nextPath(signInHref('/history').split('?')[1] ? `?${signInHref('/history').split('?')[1]}` : '')).toBe('/history');
  });
});
