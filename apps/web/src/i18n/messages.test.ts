import { describe, it, expect } from 'vitest';
import { en } from '@/i18n/messages/en';
import { bn } from '@/i18n/messages/bn';

describe('message catalogues', () => {
  it('has a Bengali string for every English key', () => {
    const missing = Object.keys(en).filter((k) => !(k in bn));
    expect(missing).toEqual([]);
  });

  it('has no Bengali keys that English lacks', () => {
    const extra = Object.keys(bn).filter((k) => !(k in en));
    expect(extra).toEqual([]);
  });

  it('has no empty strings in either catalogue', () => {
    for (const [k, v] of Object.entries(en)) expect(v.trim(), `en.${k}`).not.toBe('');
    for (const [k, v] of Object.entries(bn)) expect(v.trim(), `bn.${k}`).not.toBe('');
  });

  it('actually contains Bengali script, catching copy-pasted English', () => {
    const bengali = /[ঀ-৿]/;
    for (const [k, v] of Object.entries(bn)) {
      expect(bengali.test(v), `bn.${k} has no Bengali characters`).toBe(true);
    }
  });
});
