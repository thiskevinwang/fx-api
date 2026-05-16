// This file was written by GPT 5.5, under human supervision.

import { test, assert } from "vitest";

import { FredClient } from "./fred";

test("default fetch path preserves the runtime globalThis receiver", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl: string | undefined;

  globalThis.fetch = function (
    this: typeof globalThis,
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) {
    assert.equal(this, globalThis);
    assert.equal(init?.method, "GET");
    requestedUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    return Promise.resolve(
      Response.json({
        realtime_start: "2026-01-01",
        realtime_end: "2026-01-01",
        observation_start: "2026-01-01",
        observation_end: "2026-01-01",
        units: "lin",
        output_type: 1,
        file_type: "json",
        order_by: "observation_date",
        sort_order: "asc",
        count: 1,
        offset: 0,
        limit: 100000,
        observations: [
          {
            realtime_start: "2026-01-01",
            realtime_end: "2026-01-01",
            date: "2026-01-01",
            value: "1.23",
          },
        ],
      }),
    );
  } as typeof fetch;

  try {
    const client = new FredClient("test-key", { baseUrl: "https://fred.test" });
    const response = await client.seriesObservations({
      seriesId: "DEXUSEU",
      observationStart: "2026-01-01",
      sortOrder: "asc",
    });

    assert.equal(response.observations[0]?.value, "1.23");
    assert.equal(
      new URL(requestedUrl ?? "").searchParams.get("series_id"),
      "DEXUSEU",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
