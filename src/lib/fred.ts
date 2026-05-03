// This file was written by GPT 5.5, under human supervision.
//
// HTTP client for https://fred.stlouisfed.org/docs/api/fred/series_observations.html

const FRED_BASE_URL = "https://api.stlouisfed.org";
const FRED_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const FRED_UNITS = [
  "lin",
  "chg",
  "ch1",
  "pch",
  "pc1",
  "pca",
  "cch",
  "cca",
  "log",
] as const;

const FRED_FREQUENCIES = [
  "d",
  "w",
  "bw",
  "m",
  "q",
  "sa",
  "a",
  "wef",
  "weth",
  "wew",
  "wetu",
  "wem",
  "wesu",
  "wesa",
  "bwew",
  "bwem",
] as const;

const FRED_AGGREGATION_METHODS = ["avg", "sum", "eop"] as const;
const FRED_SORT_ORDERS = ["asc", "desc"] as const;

export type FredDateString = `${number}-${number}-${number}`;

export type FredUnits = (typeof FRED_UNITS)[number];
export type FredFrequency = (typeof FRED_FREQUENCIES)[number];
export type FredAggregationMethod = (typeof FRED_AGGREGATION_METHODS)[number];
export type FredSortOrder = (typeof FRED_SORT_ORDERS)[number];
export type FredSeriesId = string;

// The response shape below matches the linked JSON example, whose default
// output_type is 1: observations by real-time period.
export type FredSeriesObservationsOutputType = 1;

export interface FredSeriesObservationsParams {
  seriesId: FredSeriesId;
  realtimeStart?: FredDateString;
  realtimeEnd?: FredDateString;
  limit?: number;
  offset?: number;
  sortOrder?: FredSortOrder;
  observationStart?: FredDateString;
  observationEnd?: FredDateString;
  units?: FredUnits;
  frequency?: FredFrequency;
  aggregationMethod?: FredAggregationMethod;
  outputType?: FredSeriesObservationsOutputType;
  vintageDates?: FredDateString | readonly FredDateString[];
}

export interface FredSeriesObservation {
  realtime_start: FredDateString;
  realtime_end: FredDateString;
  date: FredDateString;
  value: string;
}

export interface FredSeriesObservationsResponse {
  realtime_start: FredDateString;
  realtime_end: FredDateString;
  observation_start: FredDateString;
  observation_end: FredDateString;
  units: FredUnits;
  output_type: FredSeriesObservationsOutputType;
  file_type: "json";
  order_by: "observation_date";
  sort_order: FredSortOrder;
  count: number;
  offset: number;
  limit: number;
  observations: FredSeriesObservation[];
}

export interface FredClientOptions {
  baseUrl?: string | URL;
  fetch?: typeof fetch;
}

export interface FredApiErrorDetails {
  status: number;
  statusText: string;
  url: string;
  body?: string;
  fredErrorCode?: number;
  fredErrorMessage?: string;
}

interface FredErrorPayload {
  error_code: number;
  error_message: string;
}

export class FredApiError extends Error {
  readonly name = "FredApiError";

  constructor(
    message: string,
    readonly details: FredApiErrorDetails,
  ) {
    super(message);
  }
}

export class FredResponseFormatError extends Error {
  readonly name = "FredResponseFormatError";
}

export class FredClient {
  private readonly baseUrl: URL;
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly apiKey: string,
    options: FredClientOptions = {},
  ) {
    this.baseUrl = new URL(options.baseUrl ?? FRED_BASE_URL);
    this.fetchFn =
      options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  async seriesObservations(
    params: FredSeriesObservationsParams,
    init: RequestInit = {},
  ): Promise<FredSeriesObservationsResponse> {
    const url = this.buildSeriesObservationsUrl(params);
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");

    const response = await this.fetchFn(url, {
      ...init,
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw await FredClient.toApiError(response);
    }

    const json: unknown = await response.json();
    const apiError = toFredErrorPayload(json);
    if (apiError) {
      throw new FredApiError(apiError.error_message, {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        fredErrorCode: apiError.error_code,
        fredErrorMessage: apiError.error_message,
      });
    }

    return toSeriesObservationsResponse(json);
  }

  private buildSeriesObservationsUrl(
    params: FredSeriesObservationsParams,
  ): string {
    validateSeriesObservationsParams(params);

    const url = new URL("/fred/series/observations", this.baseUrl);
    appendQueryParams(url.searchParams, {
      api_key: this.apiKey,
      file_type: "json",
      series_id: params.seriesId,
      realtime_start: params.realtimeStart,
      realtime_end: params.realtimeEnd,
      limit: params.limit,
      offset: params.offset,
      sort_order: params.sortOrder,
      observation_start: params.observationStart,
      observation_end: params.observationEnd,
      units: params.units,
      frequency: params.frequency,
      aggregation_method: params.aggregationMethod,
      output_type: params.outputType,
      vintage_dates: formatVintageDates(params.vintageDates),
    });

    return url.toString();
  }

  private static async toApiError(response: Response): Promise<FredApiError> {
    const body = await response.text();
    const parsed = parseJson(body);
    const apiError = toFredErrorPayload(parsed);
    const message =
      apiError?.error_message ??
      `FRED request failed with ${response.status} ${response.statusText}`;

    return new FredApiError(message, {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      body,
      fredErrorCode: apiError?.error_code,
      fredErrorMessage: apiError?.error_message,
    });
  }
}

function appendQueryParams(
  searchParams: URLSearchParams,
  params: Record<string, string | number | undefined>,
): void {
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }
}

function formatVintageDates(
  vintageDates: FredSeriesObservationsParams["vintageDates"],
): string | undefined {
  if (!vintageDates) {
    return undefined;
  }

  if (typeof vintageDates === "string") {
    return vintageDates;
  }

  return vintageDates.join(",");
}

function validateSeriesObservationsParams(
  params: FredSeriesObservationsParams,
): void {
  if (params.seriesId.trim().length === 0) {
    throw new TypeError("seriesId must be a non-empty string");
  }

  validateOptionalDate("realtimeStart", params.realtimeStart);
  validateOptionalDate("realtimeEnd", params.realtimeEnd);
  validateOptionalDate("observationStart", params.observationStart);
  validateOptionalDate("observationEnd", params.observationEnd);

  if (params.vintageDates) {
    const vintageDates = Array.isArray(params.vintageDates)
      ? params.vintageDates
      : [params.vintageDates];

    for (const vintageDate of vintageDates) {
      validateDate("vintageDates", vintageDate);
    }
  }

  if (
    params.limit !== undefined &&
    (!Number.isInteger(params.limit) ||
      params.limit < 1 ||
      params.limit > 100000)
  ) {
    throw new RangeError("limit must be an integer between 1 and 100000");
  }

  if (
    params.offset !== undefined &&
    (!Number.isInteger(params.offset) || params.offset < 0)
  ) {
    throw new RangeError("offset must be a non-negative integer");
  }
}

function validateOptionalDate(name: string, value: string | undefined): void {
  if (value !== undefined) {
    validateDate(name, value);
  }
}

function validateDate(name: string, value: string): void {
  if (!FRED_DATE_PATTERN.test(value)) {
    throw new TypeError(`${name} must use YYYY-MM-DD format`);
  }
}

function toSeriesObservationsResponse(
  value: unknown,
): FredSeriesObservationsResponse {
  const record = requireRecord(value, "FRED series observations response");
  const observations = record.observations;

  if (!Array.isArray(observations)) {
    throw new FredResponseFormatError(
      "FRED response observations must be an array",
    );
  }

  return {
    realtime_start: readDate(record, "realtime_start"),
    realtime_end: readDate(record, "realtime_end"),
    observation_start: readDate(record, "observation_start"),
    observation_end: readDate(record, "observation_end"),
    units: readOneOf(record, "units", FRED_UNITS),
    output_type: readLiteral(record, "output_type", 1),
    file_type: readLiteral(record, "file_type", "json"),
    order_by: readLiteral(record, "order_by", "observation_date"),
    sort_order: readOneOf(record, "sort_order", FRED_SORT_ORDERS),
    count: readNumber(record, "count"),
    offset: readNumber(record, "offset"),
    limit: readNumber(record, "limit"),
    observations: observations.map(toSeriesObservation),
  };
}

function toSeriesObservation(value: unknown): FredSeriesObservation {
  const record = requireRecord(value, "FRED observation");

  return {
    realtime_start: readDate(record, "realtime_start"),
    realtime_end: readDate(record, "realtime_end"),
    date: readDate(record, "date"),
    value: readString(record, "value"),
  };
}

function toFredErrorPayload(value: unknown): FredErrorPayload | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (
    typeof value.error_code === "number" &&
    typeof value.error_message === "string"
  ) {
    return {
      error_code: value.error_code,
      error_message: value.error_message,
    };
  }

  return undefined;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new FredResponseFormatError(`${label} must be a JSON object`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== "string") {
    throw new FredResponseFormatError(`FRED response ${key} must be a string`);
  }

  return value;
}

function readDate(
  record: Record<string, unknown>,
  key: string,
): FredDateString {
  const value = readString(record, key);
  validateDate(key, value);
  return value as FredDateString;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (typeof value !== "number") {
    throw new FredResponseFormatError(`FRED response ${key} must be a number`);
  }

  return value;
}

function readLiteral<const Value extends string | number>(
  record: Record<string, unknown>,
  key: string,
  expected: Value,
): Value {
  const value = record[key];

  if (value !== expected) {
    throw new FredResponseFormatError(
      `FRED response ${key} must be ${String(expected)}`,
    );
  }

  return expected;
}

function readOneOf<const Values extends readonly string[]>(
  record: Record<string, unknown>,
  key: string,
  allowedValues: Values,
): Values[number] {
  const value = readString(record, key);

  if (!allowedValues.includes(value)) {
    throw new FredResponseFormatError(
      `FRED response ${key} must be one of ${allowedValues.join(", ")}`,
    );
  }

  return value;
}
