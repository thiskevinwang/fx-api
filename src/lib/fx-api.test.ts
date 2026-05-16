// This file was written by GPT 5.5, under human supervision.

import { test, assert } from "vitest";

import { createFxApiApp } from "./fx-api";
import {
  FX_MANIFEST_KEY,
  type FxRateSnapshot,
  buildFxManifest,
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

test("GET / returns a barebones HTML page linking to docs with SEO metadata", async () => {
  const response = await request("/", mockBucketWithSnapshot(snapshot));
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("Content-Type"),
    "text/html; charset=utf-8",
  );

  const body = await response.text();
  assert.match(body, /^<!doctype html>/);
  assert.match(
    body,
    /<title>monies\.dev - Observed Foreign Exchange Rates<\/title>/,
  );
  assert.match(
    body,
    /<meta name="description" content="monies\.dev provides JSON endpoints for observed foreign exchange rate pairs, historical rates\.">/,
  );
  assert.match(body, /<meta name="robots" content="index, follow">/);
  assert.match(body, /<link rel="canonical" href="https:\/\/example\.test\/">/);
  assert.match(body, /<link rel="icon" href="\/favicon\.ico" sizes="any">/);
  assert.match(
    body,
    /<link rel="icon" type="image\/png" sizes="16x16" href="\/favicon-16x16\.png">/,
  );
  assert.match(
    body,
    /<link rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32x32\.png">/,
  );
  assert.match(
    body,
    /<link rel="icon" type="image\/png" sizes="48x48" href="\/favicon-48x48\.png">/,
  );
  assert.match(
    body,
    /<meta property="og:title" content="monies\.dev - Observed Foreign Exchange Rates">/,
  );
  assert.match(
    body,
    /<meta property="og:url" content="https:\/\/example\.test\/">/,
  );
  assert.match(
    body,
    /<meta property="og:image" content="https:\/\/example\.test\/og-image\.png">/,
  );
  assert.match(body, /<meta property="og:image:type" content="image\/png">/);
  assert.match(body, /<meta property="og:image:width" content="1200">/);
  assert.match(body, /<meta property="og:image:height" content="630">/);
  assert.match(
    body,
    /<meta name="twitter:card" content="summary_large_image">/,
  );
  assert.match(
    body,
    /<meta name="twitter:image" content="https:\/\/example\.test\/og-image\.png">/,
  );
  assert.match(
    body,
    /<p>Rate data is sourced from the Federal Reserve Bank of St\. Louis\.<\/p>/,
  );
  assert.match(
    body,
    /<p>By using this application, you agree to the terms of use as laid out in <a href="https:\/\/fred\.stlouisfed\.org\/docs\/api\/terms_of_use\.html">FRED API Terms of Use<\/a>\.<\/p>/,
  );
  assert.match(
    body,
    /<p>This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St\. Louis\.<\/p>/,
  );
  assert.match(body, /<a href="\/docs">View API docs<\/a>/);
});

test("GET /og-image.png serves the cached Open Graph image", async () => {
  const response = await request(
    "/og-image.png",
    mockBucketWithSnapshot(snapshot),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/png");
  assert.equal(
    response.headers.get("Cache-Control"),
    "public, max-age=604800, immutable",
  );

  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.ok(bytes.length > 1000);
  assert.deepEqual(
    Array.from(bytes.slice(0, 8)),
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  );
});

test("GET favicon assets serves cached icon files", async () => {
  const faviconIcoResponse = await request(
    "/favicon.ico",
    mockBucketWithSnapshot(snapshot),
  );
  assert.equal(faviconIcoResponse.status, 200);
  assert.equal(faviconIcoResponse.headers.get("Content-Type"), "image/x-icon");
  assert.equal(
    faviconIcoResponse.headers.get("Cache-Control"),
    "public, max-age=604800, immutable",
  );
  const faviconIcoBytes = new Uint8Array(
    await faviconIcoResponse.arrayBuffer(),
  );
  assert.ok(faviconIcoBytes.length > 1000);
  assert.deepEqual(
    Array.from(faviconIcoBytes.slice(0, 4)),
    [0x00, 0x00, 0x01, 0x00],
  );

  for (const path of [
    "/favicon-16x16.png",
    "/favicon-32x32.png",
    "/favicon-48x48.png",
    "/favicons/favicon-16x16.png",
    "/favicons/favicon-32x32.png",
    "/favicons/favicon-48x48.png",
  ]) {
    const response = await request(path, mockBucketWithSnapshot(snapshot));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "image/png");
    assert.equal(
      response.headers.get("Cache-Control"),
      "public, max-age=604800, immutable",
    );

    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.ok(bytes.length > 100);
    assert.deepEqual(
      Array.from(bytes.slice(0, 8)),
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    );
  }
});

test("GET /docs returns the docs markdown as plain text", async () => {
  const response = await request("/docs", mockBucketWithSnapshot(snapshot));
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("Content-Type"),
    "text/plain; charset=utf-8",
  );

  const body = await response.text();
  assert.match(body, /^# monies\.dev/);
  assert.match(body, /GET \/v1\/rates\/:from\/:to/);
  assert.match(body, /GET \/v1\/rates\/:from\/:to\/graph/);
  assert.match(body, /GET \/v1\/schemas\/:object/);
  assert.notMatch(
    body,
    /\b(R2|FRED|Cloudflare|Worker|Wrangler|bucket|workflow|cron|ETL)\b/i,
  );
});

test("GET /docs.md returns the same docs markdown with markdown content type", async () => {
  const [docsResponse, markdownResponse] = await Promise.all([
    request("/docs", mockBucketWithSnapshot(snapshot)),
    request("/docs.md", mockBucketWithSnapshot(snapshot)),
  ]);

  assert.equal(markdownResponse.status, 200);
  assert.equal(
    markdownResponse.headers.get("Content-Type"),
    "text/markdown; charset=utf-8",
  );
  assert.equal(await markdownResponse.text(), await docsResponse.text());
});

test("GET /v1/schemas/:object returns JSON Schema for a public object", async () => {
  const response = await request(
    "/v1/schemas/fx_rate",
    mockBucketWithSnapshot(snapshot),
  );
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("Content-Type") ?? "",
    /^application\/json/,
  );

  const body = (await response.json()) as {
    $schema: string;
    title: string;
    type: string;
    properties: {
      object: { const: string };
      rate_scale: { const: string };
    };
    required: string[];
  };

  assert.equal(body.$schema, "http://json-schema.org/draft-07/schema#");
  assert.equal(body.title, "FX Rate");
  assert.equal(body.type, "object");
  assert.equal(body.properties.object.const, "fx_rate");
  assert.equal(body.properties.rate_scale.const, "quote_per_base");
  assert.ok(body.required.includes("generated_at"));
});

test("GET /v1/schemas/:object returns not_found for unknown schema objects", async () => {
  const response = await request(
    "/v1/schemas/nope",
    mockBucketWithSnapshot(snapshot),
  );
  assert.equal(response.status, 404);

  const body = (await response.json()) as {
    error: { type: string; code: string; message: string };
  };
  assert.equal(body.error.type, "invalid_request_error");
  assert.equal(body.error.code, "not_found");
  assert.match(body.error.message, /Supported objects:/);
});

test("GET /v1/pairs returns supported manifest pairs without storage keys", async () => {
  const response = await request("/v1/pairs", mockBucketWithSnapshot(snapshot));
  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    object: "list";
    url: string;
    has_more: boolean;
    data: Array<{
      object: "fx_pair";
      id: string;
      from: string;
      to: string;
      last_observation_date: string;
      key?: string;
    }>;
  };

  assert.equal(body.object, "list");
  assert.equal(body.url, "/v1/pairs");
  assert.equal(body.has_more, false);
  assert.deepEqual(body.data, [
    {
      object: "fx_pair",
      id: "EUR-USD",
      from: "EUR",
      to: "USD",
      last_observation_date: "2026-04-11",
    },
  ]);
  assert.equal(body.data[0]?.key, undefined);
});

test("GET /v1/rates/:from/:to returns inclusive observed rates for a date range", async () => {
  const response = await request(
    "/v1/rates/eur/usd?start=2026-04-09&end=2026-04-11",
    mockBucketWithSnapshot(snapshot),
  );
  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    object: "list";
    url: string;
    has_more: boolean;
    data: Array<{
      object: "fx_rate";
      id: string;
      from: string;
      to: string;
      date: string;
      rate: string;
      rate_scale: string;
      generated_at: string;
    }>;
  };

  assert.equal(body.object, "list");
  assert.equal(body.url, "/v1/rates/eur/usd?start=2026-04-09&end=2026-04-11");
  assert.equal(body.has_more, false);
  assert.deepEqual(body.data, [
    {
      object: "fx_rate",
      id: "EUR-USD:2026-04-10",
      from: "EUR",
      to: "USD",
      date: "2026-04-10",
      rate: "1.1",
      rate_scale: "quote_per_base",
      generated_at: "2026-04-12T00:00:00.000Z",
    },
    {
      object: "fx_rate",
      id: "EUR-USD:2026-04-11",
      from: "EUR",
      to: "USD",
      date: "2026-04-11",
      rate: "1.11",
      rate_scale: "quote_per_base",
      generated_at: "2026-04-12T00:00:00.000Z",
    },
  ]);
});

test("GET /v1/rates/:from/:to asof returns the latest prior observation", async () => {
  const response = await request(
    "/v1/rates/EUR/USD?asof=2026-04-09",
    mockBucketWithSnapshot(snapshot),
  );
  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    object: "list";
    data: Array<{
      object: "fx_rate";
      id: string;
      from: string;
      to: string;
      date: string;
      rate: string;
      rate_scale: string;
      generated_at: string;
    }>;
  };

  assert.equal(body.object, "list");
  assert.deepEqual(body.data, [
    {
      object: "fx_rate",
      id: "EUR-USD:2026-04-08",
      from: "EUR",
      to: "USD",
      date: "2026-04-08",
      rate: "1.08",
      rate_scale: "quote_per_base",
      generated_at: "2026-04-12T00:00:00.000Z",
    },
  ]);
});

test("GET /v1/rates/:from/:to supports a start-only date filter", async () => {
  const response = await request(
    "/v1/rates/EUR/USD?start=2026-04-10",
    mockBucketWithSnapshot(snapshot),
  );
  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    object: "list";
    url: string;
    data: Array<{
      id: string;
      date: string;
      rate: string;
    }>;
  };

  assert.equal(body.object, "list");
  assert.equal(body.url, "/v1/rates/EUR/USD?start=2026-04-10");
  assert.deepEqual(
    body.data.map(({ id, date, rate }) => ({ id, date, rate })),
    [
      {
        id: "EUR-USD:2026-04-10",
        date: "2026-04-10",
        rate: "1.1",
      },
      {
        id: "EUR-USD:2026-04-11",
        date: "2026-04-11",
        rate: "1.11",
      },
    ],
  );
});

test("GET /v1/rates/:from/:to supports an end-only date filter", async () => {
  const response = await request(
    "/v1/rates/EUR/USD?end=2026-04-10",
    mockBucketWithSnapshot(snapshot),
  );
  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    object: "list";
    url: string;
    data: Array<{
      id: string;
      date: string;
      rate: string;
    }>;
  };

  assert.equal(body.object, "list");
  assert.equal(body.url, "/v1/rates/EUR/USD?end=2026-04-10");
  assert.deepEqual(
    body.data.map(({ id, date, rate }) => ({ id, date, rate })),
    [
      {
        id: "EUR-USD:2026-04-08",
        date: "2026-04-08",
        rate: "1.08",
      },
      {
        id: "EUR-USD:2026-04-10",
        date: "2026-04-10",
        rate: "1.1",
      },
    ],
  );
});

test("GET /v1/rates/:from/:to without query params returns all stored observations", async () => {
  const response = await request(
    "/v1/rates/EUR/USD",
    mockBucketWithSnapshot(snapshot),
  );
  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    object: "list";
    url: string;
    has_more: boolean;
    data: Array<{
      object: "fx_rate";
      id: string;
      from: string;
      to: string;
      date: string;
      rate: string;
      rate_scale: string;
      generated_at: string;
    }>;
  };

  assert.equal(body.object, "list");
  assert.equal(body.url, "/v1/rates/EUR/USD");
  assert.equal(body.has_more, false);
  assert.deepEqual(body.data, [
    {
      object: "fx_rate",
      id: "EUR-USD:2026-04-08",
      from: "EUR",
      to: "USD",
      date: "2026-04-08",
      rate: "1.08",
      rate_scale: "quote_per_base",
      generated_at: "2026-04-12T00:00:00.000Z",
    },
    {
      object: "fx_rate",
      id: "EUR-USD:2026-04-10",
      from: "EUR",
      to: "USD",
      date: "2026-04-10",
      rate: "1.1",
      rate_scale: "quote_per_base",
      generated_at: "2026-04-12T00:00:00.000Z",
    },
    {
      object: "fx_rate",
      id: "EUR-USD:2026-04-11",
      from: "EUR",
      to: "USD",
      date: "2026-04-11",
      rate: "1.11",
      rate_scale: "quote_per_base",
      generated_at: "2026-04-12T00:00:00.000Z",
    },
  ]);
});

test("GET /v1/rates/:from/:to/graph returns a plain-text Braille bar chart", async () => {
  const graphSnapshot: FxRateSnapshot = {
    ...snapshot,
    rates: [
      { date: "2026-04-08", rate: "1" },
      { date: "2026-04-10", rate: "1.242" },
      { date: "2026-04-11", rate: "1.36" },
    ],
  };
  const response = await request(
    "/v1/rates/EUR/USD/graph",
    mockBucketWithSnapshot(graphSnapshot),
  );
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("Content-Type"),
    "text/plain; charset=utf-8",
  );

  const full = "⠿";
  const twoSteps = "⠆";
  const empty = "⠀";
  const lines = (await response.text()).split("\n");
  assert.deepEqual(lines, [
    "EUR/USD quote_per_base rates",
    full.repeat(60),
    `${empty.repeat(60)}  ${"1".padStart(5)}  2026-04-08`,
    `${full.repeat(40)}${twoSteps}${empty.repeat(19)}  1.242  2026-04-10`,
    `${full.repeat(60)}  ${"1.36".padStart(5)}  2026-04-11`,
    "",
  ]);
});

test("GET /v1/rates/:from/:to/graph supports the rate query parameters", async () => {
  const response = await request(
    "/v1/rates/EUR/USD/graph?start=2026-09-01",
    mockBucketWithSnapshot(snapshot),
  );
  assert.equal(response.status, 200);

  assert.deepEqual((await response.text()).split("\n"), [
    "EUR/USD quote_per_base rates",
    "⠿".repeat(60),
    "(no observations)",
    "",
  ]);
});

test("GET /v1/rates/:from/:to rejects ranges longer than one calendar year", async () => {
  const response = await request(
    "/v1/rates/EUR/USD?start=2025-01-01&end=2026-01-02",
    mockBucketWithSnapshot(snapshot),
  );
  assert.equal(response.status, 400);

  const body = (await response.json()) as {
    error: { type: string; code: string };
  };
  assert.equal(body.error.type, "invalid_request_error");
  assert.equal(body.error.code, "bad_request");
});

test("GET /v1/rates/:from/:to returns unsupported_pair for pairs absent from the manifest", async () => {
  const response = await request(
    "/v1/rates/USD/EUR?start=2026-04-09&end=2026-04-11",
    mockBucketWithSnapshot(snapshot),
  );
  assert.equal(response.status, 404);

  const body = (await response.json()) as {
    error: { type: string; code: string };
  };
  assert.equal(body.error.type, "invalid_request_error");
  assert.equal(body.error.code, "unsupported_pair");
});

test("GET /v1/rates/:from/:to asof returns not_found when no prior observation exists", async () => {
  const response = await request(
    "/v1/rates/EUR/USD?asof=2026-04-07",
    mockBucketWithSnapshot(snapshot),
  );
  assert.equal(response.status, 404);

  const body = (await response.json()) as {
    error: { type: string; code: string };
  };
  assert.equal(body.error.type, "invalid_request_error");
  assert.equal(body.error.code, "not_found");
});

test("GET /v1/rates/:from/:to rejects legacy asOf casing", async () => {
  const response = await request(
    "/v1/rates/EUR/USD?asOf=2026-04-09",
    mockBucketWithSnapshot(snapshot),
  );
  assert.equal(response.status, 400);

  const body = (await response.json()) as {
    error: { type: string; code: string; message: string };
  };
  assert.equal(body.error.type, "invalid_request_error");
  assert.equal(body.error.code, "bad_request");
  assert.equal(body.error.message, "Use asof instead of asOf");
});

test("GET /v1/rates without path currencies is not registered", async () => {
  const response = await request(
    "/v1/rates?from=EUR&to=USD&asof=2026-04-09",
    mockBucketWithSnapshot(snapshot),
  );
  assert.equal(response.status, 404);

  const body = (await response.json()) as {
    error: { type: string; code: string };
  };
  assert.equal(body.error.type, "invalid_request_error");
  assert.equal(body.error.code, "not_found");
});

test("GET /v1/rates/:from/:to caches 200 responses for one hour", async () => {
  const cache = mockCache();
  const r2Reads: string[] = [];
  const bucket = mockBucketWithSnapshot(snapshot, r2Reads);
  const app = createFxApiApp();
  const requestUrl =
    "https://example.test/v1/rates/EUR/USD?start=2026-04-09&end=2026-04-11";

  await withMockCaches(cache, async () => {
    const firstResponse = await app.fetch(new Request(requestUrl), {
      STATIC_FILES: bucket,
    });
    assert.equal(firstResponse.status, 200);
    assert.equal(
      firstResponse.headers.get("Cache-Control"),
      "public, max-age=3600",
    );
    assert.equal(cache.putCount, 1);
    assert.equal(r2Reads.length, 2);
    const firstBody = (await firstResponse.json()) as { data: unknown[] };
    assert.equal(firstBody.data.length, 2);

    const secondResponse = await app.fetch(new Request(requestUrl), {
      STATIC_FILES: bucket,
    });
    assert.equal(secondResponse.status, 200);
    assert.equal(
      secondResponse.headers.get("Cache-Control"),
      "public, max-age=3600",
    );
    assert.equal(cache.putCount, 1);
    assert.equal(r2Reads.length, 2);
    const secondBody = (await secondResponse.json()) as { data: unknown[] };
    assert.equal(secondBody.data.length, 2);
  });
});

test("GET /v1/rates/:from/:to does not cache non-200 responses", async () => {
  const cache = mockCache();
  const bucket = mockBucketWithSnapshot(snapshot);
  const app = createFxApiApp();

  await withMockCaches(cache, async () => {
    const response = await app.fetch(
      new Request(
        "https://example.test/v1/rates/EUR/USD?start=2025-01-01&end=2026-01-02",
      ),
      {
        STATIC_FILES: bucket,
      },
    );

    assert.equal(response.status, 400);
    assert.equal(cache.putCount, 0);
  });
});

test("GET /v1/rates/:from/:to/graph caches 200 responses for one hour", async () => {
  const cache = mockCache();
  const r2Reads: string[] = [];
  const bucket = mockBucketWithSnapshot(snapshot, r2Reads);
  const app = createFxApiApp();
  const requestUrl = "https://example.test/v1/rates/EUR/USD/graph";

  await withMockCaches(cache, async () => {
    const firstResponse = await app.fetch(new Request(requestUrl), {
      STATIC_FILES: bucket,
    });
    assert.equal(firstResponse.status, 200);
    assert.equal(
      firstResponse.headers.get("Cache-Control"),
      "public, max-age=3600",
    );
    assert.equal(cache.putCount, 1);
    assert.equal(r2Reads.length, 2);
    assert.match(await firstResponse.text(), /^EUR\/USD quote_per_base rates/);

    const secondResponse = await app.fetch(new Request(requestUrl), {
      STATIC_FILES: bucket,
    });
    assert.equal(secondResponse.status, 200);
    assert.equal(
      secondResponse.headers.get("Cache-Control"),
      "public, max-age=3600",
    );
    assert.equal(cache.putCount, 1);
    assert.equal(r2Reads.length, 2);
    assert.match(await secondResponse.text(), /^EUR\/USD quote_per_base rates/);
  });
});

async function request(path: string, bucket: R2Bucket): Promise<Response> {
  const app = createFxApiApp();
  return await app.fetch(new Request(`https://example.test${path}`), {
    STATIC_FILES: bucket,
  });
}

function mockBucketWithSnapshot(
  rateSnapshot: FxRateSnapshot,
  reads?: string[],
): R2Bucket {
  return mockR2Bucket(
    {
      [FX_MANIFEST_KEY]: buildFxManifest(
        [rateSnapshot],
        rateSnapshot.generatedAt,
      ),
      [toRateSnapshotKey(rateSnapshot.from, rateSnapshot.to)]: rateSnapshot,
    },
    reads,
  );
}

function mockR2Bucket(
  objects: Record<string, unknown>,
  reads?: string[],
): R2Bucket {
  return {
    get: async (key: string) => {
      reads?.push(key);
      if (!(key in objects)) {
        return null;
      }

      return {
        json: async <T>() => objects[key] as T,
      };
    },
  } as unknown as R2Bucket;
}

function mockCache(): Cache & { putCount: number } {
  const responses = new Map<string, Response>();

  return {
    putCount: 0,
    match: async (request: RequestInfo | URL) => {
      const response = responses.get(cacheKeyUrl(request));
      return response?.clone();
    },
    put: async function (
      this: { putCount: number },
      request: RequestInfo | URL,
      response: Response,
    ) {
      this.putCount += 1;
      responses.set(
        cacheKeyUrl(request),
        new Response(await response.text(), {
          headers: response.headers,
          status: response.status,
          statusText: response.statusText,
        }),
      );
    },
    delete: async (request: RequestInfo | URL) => {
      return responses.delete(cacheKeyUrl(request));
    },
  } as Cache & { putCount: number };
}

async function withMockCaches<T>(
  cache: Cache,
  callback: () => Promise<T>,
): Promise<T> {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "caches",
  );
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      default: cache,
    },
  });

  try {
    return await callback();
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "caches", originalDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "caches");
    }
  }
}

function cacheKeyUrl(request: RequestInfo | URL): string {
  if (typeof request === "string") {
    return request;
  }

  if (request instanceof URL) {
    return request.toString();
  }

  return request.url;
}
