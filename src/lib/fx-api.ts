// This file was written by GPT 5.5, under human supervision.

import { Hono } from "hono";
import type { Context, Next } from "hono";

import docsMarkdownModule from "../docs.md";
import faviconIcoDataModule from "../assets/favicon.ico";
import favicon16DataModule from "../assets/favicons/favicon-16x16.png";
import favicon32DataModule from "../assets/favicons/favicon-32x32.png";
import favicon48DataModule from "../assets/favicons/favicon-48x48.png";
import ogImageDataModule from "../assets/og-image.png";
import {
  FX_RATE_SCALE,
  type FxDateString,
  type FxManifestPair,
  compareDateStrings,
  filterRatesByDateRange,
  isRangeWithinOneCalendarYear,
  isValidDateString,
  latestRateOnOrBefore,
  normalizeCurrencyCode,
} from "./fx";
import {
  ErrorResponseSchema,
  type FxPairResource,
  FxPairResourceSchema,
  type FxRateResource,
  FxRateResourceSchema,
  JSON_SCHEMA_OBJECT_NAMES,
  type ListResponse,
  getJsonSchemaForObject,
} from "./fx-schemas";
import { readFxManifest, readFxRateSnapshot } from "./fx-storage";

type ApiBindings = Pick<Env, "STATIC_FILES">;

type ApiErrorCode =
  | "bad_request"
  | "unsupported_pair"
  | "not_found"
  | "internal_server_error";
type ApiErrorStatus = 400 | 404 | 500;

const API_CACHE_TTL_SECONDS = 60 * 60;
const API_CACHE_CONTROL = `public, max-age=${API_CACHE_TTL_SECONDS}`;
const PLAINTEXT_CONTENT_TYPE = "text/plain; charset=utf-8";
const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";
const HTML_CONTENT_TYPE = "text/html; charset=utf-8";
const OG_IMAGE_PATH = "/og-image.png";
const OG_IMAGE_CONTENT_TYPE = "image/png";
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const IMAGE_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const IMAGE_CACHE_CONTROL = `public, max-age=${IMAGE_CACHE_TTL_SECONDS}, immutable`;
const HOME_PAGE_TITLE = "monies.dev - Observed Foreign Exchange Rates";
const HOME_PAGE_DESCRIPTION =
  "monies.dev provides JSON endpoints for observed foreign exchange rate pairs, historical rates.";

type BinaryAssetModule = ArrayBuffer | Uint8Array | string;

const BINARY_ASSETS = [
  {
    cacheKey: "og-image",
    path: OG_IMAGE_PATH,
    contentType: OG_IMAGE_CONTENT_TYPE,
    module: ogImageDataModule as BinaryAssetModule,
  },
  {
    cacheKey: "favicon-ico",
    path: "/favicon.ico",
    contentType: "image/x-icon",
    module: faviconIcoDataModule as BinaryAssetModule,
  },
  {
    cacheKey: "favicon-16",
    path: "/favicon-16x16.png",
    contentType: "image/png",
    module: favicon16DataModule as BinaryAssetModule,
  },
  {
    cacheKey: "favicon-16-nested",
    path: "/favicons/favicon-16x16.png",
    contentType: "image/png",
    module: favicon16DataModule as BinaryAssetModule,
  },
  {
    cacheKey: "favicon-32",
    path: "/favicon-32x32.png",
    contentType: "image/png",
    module: favicon32DataModule as BinaryAssetModule,
  },
  {
    cacheKey: "favicon-32-nested",
    path: "/favicons/favicon-32x32.png",
    contentType: "image/png",
    module: favicon32DataModule as BinaryAssetModule,
  },
  {
    cacheKey: "favicon-48",
    path: "/favicon-48x48.png",
    contentType: "image/png",
    module: favicon48DataModule as BinaryAssetModule,
  },
  {
    cacheKey: "favicon-48-nested",
    path: "/favicons/favicon-48x48.png",
    contentType: "image/png",
    module: favicon48DataModule as BinaryAssetModule,
  },
] as const;

interface ParsedRangeRatesQuery {
  mode: "observations";
  from: string;
  to: string;
  start?: FxDateString;
  end?: FxDateString;
}

interface ParsedAsofRatesQuery {
  mode: "asof";
  from: string;
  to: string;
  asof: FxDateString;
}

interface ParsedAllRatesQuery {
  mode: "all";
  from: string;
  to: string;
}

type ParsedRatesQuery =
  | ParsedRangeRatesQuery
  | ParsedAsofRatesQuery
  | ParsedAllRatesQuery;

export function createFxApiApp(): Hono<{ Bindings: ApiBindings }> {
  const app = new Hono<{ Bindings: ApiBindings }>();

  app.get("/", (c) =>
    c.html(homePageHtml(new URL(c.req.url).origin), 200, {
      "Content-Type": HTML_CONTENT_TYPE,
    }),
  );

  for (const asset of BINARY_ASSETS) {
    app.use(asset.path, cacheSuccessfulGetResponses(IMAGE_CACHE_CONTROL));
    app.get(
      asset.path,
      async () =>
        new Response(await getBinaryAssetBytes(asset), {
          headers: {
            "Cache-Control": IMAGE_CACHE_CONTROL,
            "Content-Type": asset.contentType,
          },
        }),
    );
  }

  app.get("/docs", async (c) =>
    c.text(await getDocsMarkdown(), 200, {
      "Content-Type": PLAINTEXT_CONTENT_TYPE,
    }),
  );
  app.get("/docs.md", async (c) =>
    c.text(await getDocsMarkdown(), 200, {
      "Content-Type": MARKDOWN_CONTENT_TYPE,
    }),
  );

  app.use("/v1/*", cacheSuccessfulGetResponses(API_CACHE_CONTROL));

  app.get("/v1/schemas/:object", (c) => {
    const schema = getJsonSchemaForObject(c.req.param("object"));
    if (!schema) {
      return apiError(
        c,
        404,
        "not_found",
        `Unknown schema object. Supported objects: ${JSON_SCHEMA_OBJECT_NAMES.join(", ")}`,
      );
    }

    return c.json(schema);
  });

  app.get("/v1/pairs", async (c) => {
    const manifest = await readFxManifest(c.env.STATIC_FILES);
    if (!manifest) {
      return apiError(
        c,
        404,
        "not_found",
        "FX pair manifest has not been generated yet",
      );
    }

    return c.json(
      listResponse(
        c,
        manifest.pairs.map((pair) => toPairResource(pair)),
      ),
    );
  });

  app.get("/v1/rates/:from/:to", async (c) => {
    const parsedQuery = parseRatesQuery(new URL(c.req.url).searchParams, {
      from: c.req.param("from"),
      to: c.req.param("to"),
    });
    if (!parsedQuery.ok) {
      return apiError(c, 400, "bad_request", parsedQuery.message);
    }

    const manifest = await readFxManifest(c.env.STATIC_FILES);
    if (!manifest) {
      return apiError(
        c,
        404,
        "not_found",
        "FX pair manifest has not been generated yet",
      );
    }

    const pair = findManifestPair(
      manifest.pairs,
      parsedQuery.query.from,
      parsedQuery.query.to,
    );
    if (!pair) {
      return apiError(c, 404, "unsupported_pair", "Unsupported FX pair");
    }

    const snapshot = await readFxRateSnapshot(c.env.STATIC_FILES, pair.key);
    if (!snapshot) {
      return apiError(c, 404, "not_found", "FX rate snapshot was not found");
    }

    if (parsedQuery.query.mode !== "asof") {
      const rates =
        parsedQuery.query.mode === "observations"
          ? filterRatesByDateRange(
              snapshot,
              parsedQuery.query.start,
              parsedQuery.query.end,
            )
          : snapshot.rates;

      return c.json(
        listResponse(
          c,
          rates.map((rate) =>
            toRateResource({
              from: parsedQuery.query.from,
              to: parsedQuery.query.to,
              generatedAt: snapshot.generatedAt,
              date: rate.date,
              rate: rate.rate,
            }),
          ),
        ),
      );
    }

    const rate = latestRateOnOrBefore(snapshot, parsedQuery.query.asof);
    if (!rate) {
      return apiError(
        c,
        404,
        "not_found",
        "No stored FX observation exists on or before asof",
      );
    }

    return c.json(
      listResponse(c, [
        toRateResource({
          from: parsedQuery.query.from,
          to: parsedQuery.query.to,
          generatedAt: snapshot.generatedAt,
          date: rate.date,
          rate: rate.rate,
        }),
      ]),
    );
  });

  app.notFound((c) => apiError(c, 404, "not_found", "Endpoint not found"));
  app.onError((error, c) => {
    console.error("api.error", {
      message: error.message,
      stack: error.stack,
    });
    return apiError(c, 500, "internal_server_error", "Internal server error");
  });

  return app;
}

function homePageHtml(origin: string): string {
  const canonicalUrl = `${origin}/`;
  const ogImageUrl = `${origin}${OG_IMAGE_PATH}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(HOME_PAGE_TITLE)}</title>
  <meta name="description" content="${escapeHtml(HOME_PAGE_DESCRIPTION)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(HOME_PAGE_TITLE)}">
  <meta property="og:description" content="${escapeHtml(HOME_PAGE_DESCRIPTION)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}">
  <meta property="og:image:type" content="${OG_IMAGE_CONTENT_TYPE}">
  <meta property="og:image:width" content="${OG_IMAGE_WIDTH}">
  <meta property="og:image:height" content="${OG_IMAGE_HEIGHT}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(HOME_PAGE_TITLE)}">
  <meta name="twitter:description" content="${escapeHtml(HOME_PAGE_DESCRIPTION)}">
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}">
</head>
<body>
  <main>
    <h1>monies.dev</h1>
    <p>Observed foreign exchange rate API for currency exchange data.</p>
    <p>Rate data is sourced from the Federal Reserve Bank of St. Louis.</p>
    <p>By using this application, you agree to the terms of use as laid out in <a href="https://fred.stlouisfed.org/docs/api/terms_of_use.html">FRED API Terms of Use</a>.</p>
    <p>This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.</p>
    <p><a href="/docs">View API docs</a></p>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function listResponse<Data>(
  c: Context<{ Bindings: ApiBindings }>,
  data: Data[],
): ListResponse<Data> {
  return {
    object: "list" as const,
    url: requestUrl(c),
    has_more: false,
    data,
  };
}

function toPairResource(pair: FxManifestPair): FxPairResource {
  return FxPairResourceSchema.parse({
    object: "fx_pair" as const,
    id: `${pair.from}-${pair.to}`,
    from: pair.from,
    to: pair.to,
    last_observation_date: pair.lastObservationDate,
  });
}

function toRateResource(rate: {
  from: string;
  to: string;
  generatedAt: string;
  date: FxDateString;
  rate: string;
}): FxRateResource {
  return FxRateResourceSchema.parse({
    object: "fx_rate" as const,
    id: `${rate.from}-${rate.to}:${rate.date}`,
    from: rate.from,
    to: rate.to,
    date: rate.date,
    rate: rate.rate,
    rate_scale: FX_RATE_SCALE,
    generated_at: rate.generatedAt,
  });
}

function requestUrl(c: Context<{ Bindings: ApiBindings }>): string {
  const url = new URL(c.req.url);
  return `${url.pathname}${url.search}`;
}

type BunRuntime = {
  file(path: string): {
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
  };
};

let cachedDocsMarkdown: string | undefined;
const cachedBinaryAssetBytes = new Map<string, Uint8Array>();

async function getDocsMarkdown(): Promise<string> {
  if (cachedDocsMarkdown) {
    return cachedDocsMarkdown;
  }

  if (docsMarkdownModule.startsWith("#")) {
    cachedDocsMarkdown = docsMarkdownModule;
    return cachedDocsMarkdown;
  }

  const bun = (globalThis as { Bun?: BunRuntime }).Bun;
  if (bun) {
    cachedDocsMarkdown = await bun.file(docsMarkdownModule).text();
    return cachedDocsMarkdown;
  }

  return docsMarkdownModule;
}

async function getBinaryAssetBytes(asset: {
  cacheKey: string;
  module: BinaryAssetModule;
}): Promise<Uint8Array> {
  const cachedBytes = cachedBinaryAssetBytes.get(asset.cacheKey);
  if (cachedBytes) {
    return cachedBytes;
  }

  if (typeof asset.module === "string") {
    const bun = (globalThis as { Bun?: BunRuntime }).Bun;
    if (!bun) {
      throw new Error("Binary asset module did not resolve to bytes");
    }

    const bytes = new Uint8Array(await bun.file(asset.module).arrayBuffer());
    cachedBinaryAssetBytes.set(asset.cacheKey, bytes);
    return bytes;
  }

  const bytes =
    asset.module instanceof Uint8Array
      ? asset.module
      : new Uint8Array(asset.module);
  cachedBinaryAssetBytes.set(asset.cacheKey, bytes);
  return bytes;
}

function cacheSuccessfulGetResponses(cacheControl: string) {
  return async (c: Context<{ Bindings: ApiBindings }>, next: Next) => {
    if (c.req.method !== "GET" || typeof caches === "undefined") {
      await next();
      return;
    }

    const cache = caches.default;
    const cacheKey = toCacheKey(c.req.raw);
    const cachedResponse = await readFromCache(cache, cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    await next();

    if (c.res.status !== 200) {
      return;
    }

    const cacheableResponses = toCacheableResponses(c.res, cacheControl);
    if (!cacheableResponses) {
      return;
    }

    c.res = cacheableResponses.clientResponse;
    await writeToCache(cache, cacheKey, cacheableResponses.cacheResponse);
  };
}

function toCacheKey(request: Request): Request {
  return new Request(request.url, {
    headers: request.headers,
    method: "GET",
  });
}

function toCacheableResponses(
  response: Response,
  cacheControl: string,
): { clientResponse: Response; cacheResponse: Response } | undefined {
  if (response.bodyUsed) {
    console.warn("api.cache_skip_body_used");
    return undefined;
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", cacheControl);

  const init = {
    status: response.status,
    statusText: response.statusText,
  };

  if (!response.body) {
    return {
      clientResponse: new Response(null, {
        ...init,
        headers: new Headers(headers),
      }),
      cacheResponse: new Response(null, {
        ...init,
        headers: new Headers(headers),
      }),
    };
  }

  const [clientBody, cacheBody] = response.body.tee();
  return {
    clientResponse: new Response(clientBody, {
      ...init,
      headers: new Headers(headers),
    }),
    cacheResponse: new Response(cacheBody, {
      ...init,
      headers: new Headers(headers),
    }),
  };
}

async function readFromCache(
  cache: Cache,
  cacheKey: Request,
): Promise<Response | undefined> {
  try {
    return await cache.match(cacheKey);
  } catch (error) {
    console.warn("api.cache_match_failed", {
      message: errorToMessage(error),
      url: cacheKey.url,
    });
    return undefined;
  }
}

async function writeToCache(
  cache: Cache,
  cacheKey: Request,
  response: Response,
): Promise<void> {
  try {
    await cache.put(cacheKey, response);
  } catch (error) {
    console.warn("api.cache_put_failed", {
      message: errorToMessage(error),
      url: cacheKey.url,
    });
  }
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function parseRatesQuery(
  searchParams: URLSearchParams,
  pair: { from: string; to: string },
): { ok: true; query: ParsedRatesQuery } | { ok: false; message: string } {
  const from = parseCurrencyPathParam("from", pair.from);
  if (!from.ok) {
    return from;
  }

  const to = parseCurrencyPathParam("to", pair.to);
  if (!to.ok) {
    return to;
  }

  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const asof = searchParams.get("asof");
  const hasAnyRangeParam = start !== null || end !== null;

  if (searchParams.has("asOf")) {
    return {
      ok: false,
      message: "Use asof instead of asOf",
    };
  }

  if (asof !== null) {
    if (hasAnyRangeParam) {
      return {
        ok: false,
        message: "Provide either start/end filters or asof, not both",
      };
    }

    const parsedAsof = parseDateParam("asof", asof);
    if (!parsedAsof.ok) {
      return parsedAsof;
    }

    return {
      ok: true,
      query: {
        mode: "asof",
        from: from.value,
        to: to.value,
        asof: parsedAsof.value,
      },
    };
  }

  if (start === null && end === null) {
    return {
      ok: true,
      query: {
        mode: "all",
        from: from.value,
        to: to.value,
      },
    };
  }

  const parsedStart =
    start === null ? undefined : parseDateParam("start", start);
  if (parsedStart && !parsedStart.ok) {
    return parsedStart;
  }

  const parsedEnd = end === null ? undefined : parseDateParam("end", end);
  if (parsedEnd && !parsedEnd.ok) {
    return parsedEnd;
  }

  if (
    parsedStart &&
    parsedEnd &&
    compareDateStrings(parsedEnd.value, parsedStart.value) < 0
  ) {
    return {
      ok: false,
      message: "end must be on or after start",
    };
  }

  if (
    parsedStart &&
    parsedEnd &&
    !isRangeWithinOneCalendarYear(parsedStart.value, parsedEnd.value)
  ) {
    return {
      ok: false,
      message: "Date range must not exceed 1 calendar year",
    };
  }

  return {
    ok: true,
    query: {
      mode: "observations",
      from: from.value,
      to: to.value,
      start: parsedStart?.value,
      end: parsedEnd?.value,
    },
  };
}

function parseCurrencyPathParam(
  name: "from" | "to",
  rawValue: string | undefined,
): { ok: true; value: string } | { ok: false; message: string } {
  if (rawValue === undefined) {
    return {
      ok: false,
      message: `${name} path parameter is required`,
    };
  }

  const value = normalizeCurrencyCode(rawValue);
  if (!value) {
    return {
      ok: false,
      message: `${name} must be a three-letter currency code`,
    };
  }

  return { ok: true, value };
}

function parseDateParam(
  name: string,
  value: string,
): { ok: true; value: FxDateString } | { ok: false; message: string } {
  if (!isValidDateString(value)) {
    return {
      ok: false,
      message: `${name} must be a valid YYYY-MM-DD date`,
    };
  }

  return { ok: true, value };
}

function findManifestPair(
  pairs: readonly FxManifestPair[],
  from: string,
  to: string,
): FxManifestPair | undefined {
  return pairs.find((pair) => pair.from === from && pair.to === to);
}

function apiError(
  c: Context<{ Bindings: ApiBindings }>,
  status: ApiErrorStatus,
  code: ApiErrorCode,
  message: string,
) {
  return c.json(
    ErrorResponseSchema.parse({
      error: {
        type: status === 500 ? "api_error" : "invalid_request_error",
        code,
        message,
      },
    }),
    status,
  );
}
