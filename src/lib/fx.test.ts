// This file was written by GPT 5.5, under human supervision.

import { test, assert } from "vitest";

import {
  type FxRateSnapshot,
  filterRatesByDateRange,
  isRangeWithinOneCalendarYear,
  isValidDateString,
  latestRateOnOrBefore,
  normalizeCurrencyCode,
  toPairKey,
  toRateSnapshotKey,
} from "./fx";

const snapshot: FxRateSnapshot = {
  schemaVersion: 1,
  from: "EUR",
  to: "USD",
  rateScale: "quote_per_base",
  generatedAt: "2026-04-12T00:00:00.000Z",
  observationStart: "2026-04-08",
  observationEnd: "2026-04-11",
  rates: [
    { date: "2026-04-08", rate: "1.08" },
    { date: "2026-04-10", rate: "1.1" },
    { date: "2026-04-11", rate: "1.11" },
  ],
};

void test("normalizes currency codes and pair keys", () => {
  assert.equal(normalizeCurrencyCode(" eur "), "EUR");
  assert.equal(normalizeCurrencyCode("EURO"), undefined);
  assert.equal(toPairKey("eur", "usd"), "EUR-USD");
  assert.equal(toRateSnapshotKey("eur", "usd"), "fx/v1/rates/EUR-USD.json");
});

void test("validates real calendar dates", () => {
  assert.equal(isValidDateString("2024-02-29"), true);
  assert.equal(isValidDateString("2026-02-29"), false);
  assert.equal(isValidDateString("2026-2-09"), false);
});

void test("enforces a maximum one-calendar-year range", () => {
  assert.equal(isRangeWithinOneCalendarYear("2025-01-01", "2026-01-01"), true);
  assert.equal(isRangeWithinOneCalendarYear("2025-01-01", "2026-01-02"), false);
  assert.equal(isRangeWithinOneCalendarYear("2026-01-02", "2026-01-01"), false);
});

void test("filters snapshots by observed dates only", () => {
  assert.deepEqual(
    filterRatesByDateRange(snapshot, "2026-04-09", "2026-04-10"),
    [{ date: "2026-04-10", rate: "1.1" }],
  );
  assert.deepEqual(filterRatesByDateRange(snapshot, "2026-04-10"), [
    { date: "2026-04-10", rate: "1.1" },
    { date: "2026-04-11", rate: "1.11" },
  ]);
  assert.deepEqual(filterRatesByDateRange(snapshot, undefined, "2026-04-10"), [
    { date: "2026-04-08", rate: "1.08" },
    { date: "2026-04-10", rate: "1.1" },
  ]);
});

void test("finds the latest observed rate on or before an asOf date", () => {
  assert.deepEqual(latestRateOnOrBefore(snapshot, "2026-04-09"), {
    date: "2026-04-08",
    rate: "1.08",
  });
  assert.equal(latestRateOnOrBefore(snapshot, "2026-04-07"), undefined);
});
