// This file was written by GPT 5.5, under human supervision.

export const FX_SCHEMA_VERSION = 1;
export const FX_RATE_SCALE = "quote_per_base";
export const FX_MANIFEST_KEY = "fx/v1/manifest.json";
export const FX_RATES_PREFIX = "fx/v1/rates";
export const FX_ETL_LOOKBACK_DAYS = 400;

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?$/;

export type FxDateString = `${number}-${number}-${number}`;
export type FxRateScale = typeof FX_RATE_SCALE;

export interface FxRateObservation {
  date: FxDateString;
  rate: string;
}

export interface FxRateSnapshot {
  schemaVersion: typeof FX_SCHEMA_VERSION;
  from: string;
  to: string;
  rateScale: FxRateScale;
  generatedAt: string;
  observationStart: FxDateString;
  observationEnd: FxDateString;
  rates: FxRateObservation[];
}

export interface FxManifestPair {
  from: string;
  to: string;
  key: string;
  lastObservationDate: FxDateString;
}

export interface FxManifest {
  schemaVersion: typeof FX_SCHEMA_VERSION;
  generatedAt: string;
  pairs: FxManifestPair[];
}

export interface FxSnapshotSummary {
  pairCount: number;
  rateCount: number;
  observationStart?: FxDateString;
  observationEnd?: FxDateString;
}

export function normalizeCurrencyCode(value: string): string | undefined {
  const normalized = value.trim().toUpperCase();
  return CURRENCY_CODE_PATTERN.test(normalized) ? normalized : undefined;
}

export function toPairKey(from: string, to: string): string {
  return `${from.toUpperCase()}-${to.toUpperCase()}`;
}

export function toRateSnapshotKey(from: string, to: string): string {
  return `${FX_RATES_PREFIX}/${toPairKey(from, to)}.json`;
}

export function isValidDateString(value: string): value is FxDateString {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return false;
  }

  return true;
}

export function compareDateStrings(
  left: FxDateString,
  right: FxDateString,
): number {
  return left.localeCompare(right);
}

export function dateFromTimestamp(timestamp: number): FxDateString {
  return new Date(timestamp).toISOString().slice(0, 10) as FxDateString;
}

export function subtractCalendarDays(
  date: FxDateString,
  days: number,
): FxDateString {
  const parsed = parseDateParts(date);
  const value = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  value.setUTCDate(value.getUTCDate() - days);
  return formatUtcDate(value);
}

export function isRangeWithinOneCalendarYear(
  start: FxDateString,
  end: FxDateString,
): boolean {
  if (compareDateStrings(end, start) < 0) {
    return false;
  }

  return compareDateStrings(end, addCalendarYears(start, 1)) <= 0;
}

export function filterRatesByDateRange(
  snapshot: FxRateSnapshot,
  start?: FxDateString,
  end?: FxDateString,
): FxRateObservation[] {
  return snapshot.rates.filter(
    (rate) =>
      (!start || compareDateStrings(rate.date, start) >= 0) &&
      (!end || compareDateStrings(rate.date, end) <= 0),
  );
}

export function latestRateOnOrBefore(
  snapshot: FxRateSnapshot,
  asOf: FxDateString,
): FxRateObservation | undefined {
  for (let index = snapshot.rates.length - 1; index >= 0; index -= 1) {
    const rate = snapshot.rates[index];
    if (rate && compareDateStrings(rate.date, asOf) <= 0) {
      return rate;
    }
  }

  return undefined;
}

export function normalizeDecimalString(value: string): string | undefined {
  const match = DECIMAL_PATTERN.exec(value.trim());
  if (!match) {
    return undefined;
  }

  const whole = match[1].replace(/^0+(?=\d)/, "");
  const fractional = match[2]?.replace(/0+$/, "") ?? "";
  return fractional.length > 0 ? `${whole}.${fractional}` : whole;
}

export function buildFxManifest(
  snapshots: readonly FxRateSnapshot[],
  generatedAt: string,
): FxManifest {
  const pairs = snapshots
    .filter((snapshot) => snapshot.rates.length > 0)
    .map((snapshot) => ({
      from: snapshot.from,
      to: snapshot.to,
      key: toRateSnapshotKey(snapshot.from, snapshot.to),
      lastObservationDate: snapshot.rates[snapshot.rates.length - 1].date,
    }))
    .sort((left, right) =>
      toPairKey(left.from, left.to).localeCompare(
        toPairKey(right.from, right.to),
      ),
    );

  return {
    schemaVersion: FX_SCHEMA_VERSION,
    generatedAt,
    pairs,
  };
}

export function summarizeFxSnapshots(
  snapshots: readonly FxRateSnapshot[],
): FxSnapshotSummary {
  let observationStart: FxDateString | undefined;
  let observationEnd: FxDateString | undefined;
  let rateCount = 0;

  for (const snapshot of snapshots) {
    rateCount += snapshot.rates.length;
    if (
      !observationStart ||
      compareDateStrings(snapshot.observationStart, observationStart) < 0
    ) {
      observationStart = snapshot.observationStart;
    }
    if (
      !observationEnd ||
      compareDateStrings(snapshot.observationEnd, observationEnd) > 0
    ) {
      observationEnd = snapshot.observationEnd;
    }
  }

  return {
    pairCount: snapshots.length,
    rateCount,
    observationStart,
    observationEnd,
  };
}

export function parseFxManifest(value: unknown): FxManifest {
  const record = requireRecord(value, "FX manifest");
  const pairs = record.pairs;
  if (!Array.isArray(pairs)) {
    throw new TypeError("FX manifest pairs must be an array");
  }

  return {
    schemaVersion: readLiteral(record, "schemaVersion", FX_SCHEMA_VERSION),
    generatedAt: readString(record, "generatedAt"),
    pairs: pairs.map(parseFxManifestPair),
  };
}

export function parseFxRateSnapshot(value: unknown): FxRateSnapshot {
  const record = requireRecord(value, "FX rate snapshot");
  const rates = record.rates;
  if (!Array.isArray(rates)) {
    throw new TypeError("FX rate snapshot rates must be an array");
  }

  return {
    schemaVersion: readLiteral(record, "schemaVersion", FX_SCHEMA_VERSION),
    from: readCurrencyCode(record, "from"),
    to: readCurrencyCode(record, "to"),
    rateScale: readLiteral(record, "rateScale", FX_RATE_SCALE),
    generatedAt: readString(record, "generatedAt"),
    observationStart: readDate(record, "observationStart"),
    observationEnd: readDate(record, "observationEnd"),
    rates: rates.map(parseFxRateObservation),
  };
}

function parseFxManifestPair(value: unknown): FxManifestPair {
  const record = requireRecord(value, "FX manifest pair");
  return {
    from: readCurrencyCode(record, "from"),
    to: readCurrencyCode(record, "to"),
    key: readString(record, "key"),
    lastObservationDate: readDate(record, "lastObservationDate"),
  };
}

function parseFxRateObservation(value: unknown): FxRateObservation {
  const record = requireRecord(value, "FX rate observation");
  const rate = readString(record, "rate");
  if (!normalizeDecimalString(rate)) {
    throw new TypeError("FX rate observation rate must be a decimal string");
  }

  return {
    date: readDate(record, "date"),
    rate,
  };
}

function addCalendarYears(date: FxDateString, years: number): FxDateString {
  const parsed = parseDateParts(date);
  const targetYear = parsed.year + years;
  const targetDay = Math.min(parsed.day, daysInMonth(targetYear, parsed.month));
  return formatDateParts(targetYear, parsed.month, targetDay);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseDateParts(date: FxDateString): {
  year: number;
  month: number;
  day: number;
} {
  const match = DATE_PATTERN.exec(date);
  if (!match) {
    throw new TypeError("date must use YYYY-MM-DD format");
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function formatUtcDate(date: Date): FxDateString {
  return date.toISOString().slice(0, 10) as FxDateString;
}

function formatDateParts(
  year: number,
  month: number,
  day: number,
): FxDateString {
  const paddedMonth = String(month).padStart(2, "0");
  const paddedDay = String(day).padStart(2, "0");
  return `${year}-${paddedMonth}-${paddedDay}` as FxDateString;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be a JSON object`);
  }

  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new TypeError(`${key} must be a string`);
  }

  return value;
}

function readCurrencyCode(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = normalizeCurrencyCode(readString(record, key));
  if (!value) {
    throw new TypeError(`${key} must be a three-letter currency code`);
  }

  return value;
}

function readDate(record: Record<string, unknown>, key: string): FxDateString {
  const value = readString(record, key);
  if (!isValidDateString(value)) {
    throw new TypeError(`${key} must be a valid YYYY-MM-DD date`);
  }

  return value;
}

function readLiteral<const Value extends string | number>(
  record: Record<string, unknown>,
  key: string,
  expected: Value,
): Value {
  if (record[key] !== expected) {
    throw new TypeError(`${key} must be ${String(expected)}`);
  }

  return expected;
}
