import { describe, it, expect } from 'vitest';
import { inUnit, speedUnitFor } from '@/lib/units';
import { areaFromAddress, classifyRoad, parseMaxspeed } from '@/lib/geocode';

describe('units', () => {
  it('shows mph where road signs are in mph, km/h elsewhere', () => {
    expect(speedUnitFor('GB')).toBe('mph');
    expect(speedUnitFor('us')).toBe('mph');
    expect(speedUnitFor('BD')).toBe('km/h');
    expect(speedUnitFor(null)).toBe('km/h');
  });

  it('a 30 mph sign round-trips through km/h back to 30', () => {
    const kmh = parseMaxspeed('30 mph') as number;
    expect(kmh).toBe(48);
    expect(inUnit(kmh, 'mph')).toBe(30);
  });
});

describe('road classification by country', () => {
  it('Dhaka: arterials and residential streets are city roads at 40', () => {
    expect(classifyRoad('primary', 'Urban', 'BD')).toEqual({ roadType: 'City Road', limit: 40 });
    expect(classifyRoad('residential', 'Urban', 'BD')).toEqual({ roadType: 'City Road', limit: 40 });
    expect(classifyRoad('motorway', 'Urban', 'BD')).toEqual({ roadType: 'Highway', limit: 60 });
  });

  it('Britain: 30 mph in town, 60 mph rural A-road, 70 mph motorway', () => {
    expect(classifyRoad('primary', 'Urban', 'GB').limit).toBe(48);
    expect(classifyRoad('primary', 'Rural', 'GB')).toEqual({ roadType: 'Highway', limit: 97 });
    expect(classifyRoad('motorway', 'Rural', 'GB').limit).toBe(113);
  });

  it('unknown countries get common defaults', () => {
    expect(classifyRoad('secondary', 'Urban', 'FR').limit).toBe(50);
    expect(classifyRoad('motorway', 'Rural', 'FR').limit).toBe(110);
  });

  it('reads British national speed limit tags', () => {
    expect(parseMaxspeed('GB:nsl_single')).toBe(97);
    expect(parseMaxspeed('none')).toBeNull();
  });

  it('town vs countryside from the address', () => {
    expect(areaFromAddress({ city: 'Dhaka' })).toBe('Urban');
    expect(areaFromAddress({ village: 'Little Snoring', county: 'Norfolk' })).toBe('Rural');
  });
});
