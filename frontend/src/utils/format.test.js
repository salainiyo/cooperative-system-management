import { describe, it, expect } from 'vitest';
import { formatRWF, formatMoney, formatDate, formatDateTime } from './format';

describe('formatRWF', () => {
  it('formats numbers with thousands separators', () => {
    expect(formatRWF(1234567)).toBe('1,234,567');
  });

  it('handles numeric strings and falsy values', () => {
    expect(formatRWF('5000')).toBe('5,000');
    expect(formatRWF(null)).toBe('0');
    expect(formatRWF(undefined)).toBe('0');
    expect(formatRWF('')).toBe('0');
  });

  it('respects the maximumFractionDigits option', () => {
    expect(formatRWF(1234.567, { maximumFractionDigits: 2 })).toBe('1,234.57');
  });

  it('is exported as formatMoney for convenience', () => {
    expect(formatMoney(2000)).toBe(formatRWF(2000));
  });
});

describe('formatDate / formatDateTime', () => {
  it('returns N/A for empty values', () => {
    expect(formatDate(null)).toBe('N/A');
    expect(formatDateTime(undefined)).toBe('N/A');
  });

  it('formats a valid date', () => {
    const out = formatDate('2026-01-15T00:00:00Z');
    expect(out).toContain('2026');
    expect(out).toMatch(/Jan|15/);
  });

  it('includes a time in formatDateTime', () => {
    const out = formatDateTime('2026-01-15T10:30:00Z');
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });
});
