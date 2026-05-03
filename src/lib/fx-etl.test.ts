// This file was written by GPT 5.5, under human supervision.

import assert from "node:assert/strict";
import test from "node:test";

import type { FredSeriesObservation } from "./fred";
import {
  type FredFxPairConfig,
  buildFxSnapshotsFromFredObservationSets,
  getUniqueFredSeriesIds,
} from "./fx-etl";

const pairConfigs = [
  {
    seriesId: "TESTSERIES",
    from: "EUR",
    to: "USD",
    invertSourceRate: false,
    sourceUnits: "U.S. Dollars to One Euro",
  },
  {
    seriesId: "TESTSERIES",
    from: "USD",
    to: "EUR",
    invertSourceRate: true,
    sourceUnits: "U.S. Dollars to One Euro",
  },
] satisfies readonly FredFxPairConfig[];

void test("deduplicates FRED source series IDs", () => {
  assert.deepEqual(getUniqueFredSeriesIds(pairConfigs), ["TESTSERIES"]);
});

void test("builds direct and inverted pair snapshots from one source series", () => {
  const snapshots = buildFxSnapshotsFromFredObservationSets(
    [
      {
        seriesId: "TESTSERIES",
        observations: [
          fredObservation("2026-01-01", "1.25"),
          fredObservation("2026-01-02", "."),
          fredObservation("2026-01-03", "2.0000"),
        ],
      },
    ],
    {
      generatedAt: "2026-01-04T00:00:00.000Z",
      pairConfigs,
    },
  );

  assert.equal(snapshots.length, 2);
  assert.deepEqual(snapshots[0], {
    schemaVersion: 1,
    from: "EUR",
    to: "USD",
    rateScale: "quote_per_base",
    generatedAt: "2026-01-04T00:00:00.000Z",
    observationStart: "2026-01-01",
    observationEnd: "2026-01-03",
    rates: [
      { date: "2026-01-01", rate: "1.25" },
      { date: "2026-01-03", rate: "2" },
    ],
  });
  assert.deepEqual(snapshots[1]?.rates, [
    { date: "2026-01-01", rate: "0.8" },
    { date: "2026-01-03", rate: "0.5" },
  ]);
});

function fredObservation(
  date: FredSeriesObservation["date"],
  value: string,
): FredSeriesObservation {
  return {
    realtime_start: date,
    realtime_end: date,
    date,
    value,
  };
}
