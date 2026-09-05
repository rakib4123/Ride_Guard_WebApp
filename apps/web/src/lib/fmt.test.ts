import { describe, it, expect } from 'vitest';
import { fmt } from '@/lib/fmt';

describe('fmt', () => {
  it('renders percentages as Western digits', () => {
    expect(fmt.pct(0.395)).toBe('40');
    expect(fmt.pct(0)).toBe('0');
    expect(fmt.pct(1)).toBe('100');
  });

  it('clamps percentages into 0..100', () => {
    expect(fmt.pct(-0.5)).toBe('0');
    expect(fmt.pct(2)).toBe('100');
  });

  it('renders distance to one decimal', () => {
    expect(fmt.km(18.24)).toBe('18.2');
  });

  it('renders speed as a whole number', () => {
    expect(fmt.speed(52.6)).toBe('53');
  });

  it('never emits Bengali digits', () => {
    const out = [fmt.pct(0.4), fmt.km(18.2), fmt.speed(52)].join('');
    expect(out).not.toMatch(/[০-৯]/);
  });
});
