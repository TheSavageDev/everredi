import { addDays, startOfUtcDay } from './date';

describe('date helpers', () => {
  it('adds days', () => {
    const d = new Date('2026-01-01T00:00:00.000Z');
    expect(addDays(d, 14).toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('starts utc day', () => {
    const d = new Date('2026-07-23T15:30:00.000Z');
    expect(startOfUtcDay(d).toISOString()).toBe('2026-07-23T00:00:00.000Z');
  });
});
