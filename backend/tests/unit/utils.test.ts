import { parseDurationToSeconds, loadConfig } from '../../src/config';
import { isValidDateString, isValidTimeZone, todayInTimeZone } from '../../src/utils/dates';
import { fromCents, hasAtMostTwoDecimals, toCents } from '../../src/utils/money';

describe('money helpers', () => {
  it('converts between amounts and cents without rounding errors', () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(fromCents(150050)).toBe(1500.5);
  });

  it('accepts at most two decimal places', () => {
    expect(hasAtMostTwoDecimals(10)).toBe(true);
    expect(hasAtMostTwoDecimals(10.5)).toBe(true);
    expect(hasAtMostTwoDecimals(10.25)).toBe(true);
    expect(hasAtMostTwoDecimals(10.255)).toBe(false);
  });
});

describe('date helpers', () => {
  it('validates real calendar dates', () => {
    expect(isValidDateString('2024-02-29')).toBe(true); // leap year
    expect(isValidDateString('2025-02-29')).toBe(false);
    expect(isValidDateString('2025-13-01')).toBe(false);
    expect(isValidDateString('2025-1-1')).toBe(false);
    expect(isValidDateString('not a date')).toBe(false);
  });

  it('works out "today" in the configured timezone', () => {
    // 20:00 UTC on 1 March is already 2 March in India (UTC+5:30).
    const instant = new Date('2025-03-01T20:00:00Z');
    expect(todayInTimeZone('UTC', instant)).toBe('2025-03-01');
    expect(todayInTimeZone('Asia/Kolkata', instant)).toBe('2025-03-02');
  });

  it('recognises valid timezones', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('config', () => {
  const validEnv = {
    DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    JWT_SECRET: 'a'.repeat(32),
  };

  it('parses durations like 7d and 12h', () => {
    expect(parseDurationToSeconds('7d')).toBe(604_800);
    expect(parseDurationToSeconds('12h')).toBe(43_200);
    expect(() => parseDurationToSeconds('7 days')).toThrow('Invalid duration');
  });

  it('applies defaults for optional settings', () => {
    expect(loadConfig(validEnv)).toEqual({
      port: 4000,
      databaseUrl: validEnv.DATABASE_URL,
      jwtSecret: validEnv.JWT_SECRET,
      jwtExpiresInSeconds: 604_800,
      timeZone: 'UTC',
    });
  });

  it('fails with a readable message when required settings are missing or weak', () => {
    expect(() => loadConfig({})).toThrow('DATABASE_URL');
    expect(() => loadConfig({ ...validEnv, JWT_SECRET: 'short' })).toThrow('at least 32 characters');
    expect(() => loadConfig({ ...validEnv, APP_TIMEZONE: 'Nowhere/City' })).toThrow('APP_TIMEZONE');
  });
});
