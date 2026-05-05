import { exports, env } from "cloudflare:workers";

import { describe, it, expect } from "vitest";

import { buildFxManifest, type FxRateSnapshot } from "../src/lib/fx";
import { writeFxSnapshotsAndManifest } from "../src/lib/fx-storage";

const rateSnapshot: FxRateSnapshot = {
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

describe("API", () => {
  it("responds with not found and proper status for /404", async () => {
    const response = await exports.default.fetch("http://example.com/404");
    expect(response.status).toBe(404);
    expect(await response.text()).toMatchInlineSnapshot(
      `"{"error":{"type":"invalid_request_error","code":"not_found","message":"Endpoint not found"}}"`,
    );
  });

  it("responds with html for /", async () => {
    const response = await exports.default.fetch("http://example.com/");
    expect(response.status).toBe(200);
    await expect(await response.text()).toMatchFileSnapshot(
      "./index.snapshot.html",
    );
  });

  it("should cache a successful response", async () => {
    await writeFxSnapshotsAndManifest(
      env.STATIC_FILES,
      [rateSnapshot],
      buildFxManifest([rateSnapshot], rateSnapshot.generatedAt),
    );

    let response: Response;

    response = await exports.default.fetch(
      "http://example.com/v1/rates/eur/usd",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("CF-Cache-Status")).toBe(null);

    response = await exports.default.fetch(
      "http://example.com/v1/rates/eur/usd",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("CF-Cache-Status")).toBe("HIT");
  });

  it.each([
    ["?asof=1", 400],
    ["?start=2026-04-08&end=2026-04-07", 400],
    ["?asof=2025-01-01", 404],
    ["?asof=2026-05-01", 200],
    ["?start=2026-09-01", 200],
    ["?end=2026-09-01", 200],
    ["?start=2026-04-08&end=2026-04-09", 200],
  ])("should handle query params", async (queryparams, wantStatus) => {
    await writeFxSnapshotsAndManifest(
      env.STATIC_FILES,
      [rateSnapshot],
      buildFxManifest([rateSnapshot], rateSnapshot.generatedAt),
    );

    const url = new URL("http://example.com/v1/rates/eur/usd");
    url.search = queryparams.toString();

    const response = await exports.default.fetch(url);
    expect(response.status).toBe(wantStatus);
  });

  it("should fallback to a default version", async () => {
    const request = new Request("http://example.com/v1/pairs");
    const response = await exports.default.fetch(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Api-Version")).toEqual("2026-05-05.beta");
  });

  it("should accept a version", async () => {
    const request = new Request("http://example.com/v1/pairs", {
      headers: { "api-version": "2026-05-05.beta" },
    });
    const response = await exports.default.fetch(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Api-Version")).toEqual("2026-05-05.beta");
  });

  it("should reject an invalid version", async () => {
    const request = new Request("http://example.com/v1/pairs", {
      headers: { "api-version": "2000-01-01" },
    });
    const response = await exports.default.fetch(request);
    expect(response.status).toBe(400);
  });
});
