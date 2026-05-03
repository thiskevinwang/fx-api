// This file was written by GPT 5.5, under human supervision.

import type { FredSeriesId, FredSeriesObservation } from "./fred";
import { FredClient } from "./fred";
import {
  FX_ETL_LOOKBACK_DAYS,
  FX_RATE_SCALE,
  FX_SCHEMA_VERSION,
  type FxDateString,
  type FxRateObservation,
  type FxRateSnapshot,
  dateFromTimestamp,
  normalizeDecimalString,
  subtractCalendarDays,
} from "./fx";

const INVERTED_RATE_FRACTION_DIGITS = 12;

export type FxEtlCurrencyCode =
  | "AUD"
  | "CAD"
  | "CHF"
  | "CNY"
  | "EUR"
  | "GBP"
  | "INR"
  | "JPY"
  | "KRW"
  | "MXN"
  | "USD";

export interface FredFxPairConfig {
  seriesId: FredSeriesId;
  from: FxEtlCurrencyCode;
  to: FxEtlCurrencyCode;
  invertSourceRate: boolean;
  sourceUnits: string;
}

export interface FredObservationSet {
  seriesId: FredSeriesId;
  observations: FredSeriesObservation[];
}

export interface FredObservationFetchFailure {
  seriesId: FredSeriesId;
  message: string;
}

export interface FredObservationFetchResult {
  sourceSeriesCount: number;
  observationStart: FxDateString;
  observationEnd?: FxDateString;
  series: FredObservationSet[];
  failures: FredObservationFetchFailure[];
}

export interface FetchFredObservationSetsOptions {
  observationStart: FxDateString;
  observationEnd?: FxDateString;
  pairConfigs?: readonly FredFxPairConfig[];
}

export interface BuildFxSnapshotsOptions {
  generatedAt: string;
  pairConfigs?: readonly FredFxPairConfig[];
}

// This config is effectively the API's supported pair list. The ETL writes one
// snapshot for each entry here, then the API exposes only pairs present in the
// generated manifest.
export const FRED_COMMON_USD_FX_PAIR_CONFIGS = [
  {
    seriesId: "DEXUSEU",
    from: "EUR",
    to: "USD",
    invertSourceRate: false,
    sourceUnits: "U.S. Dollars to One Euro",
  },
  {
    seriesId: "DEXUSEU",
    from: "USD",
    to: "EUR",
    invertSourceRate: true,
    sourceUnits: "U.S. Dollars to One Euro",
  },
  {
    seriesId: "DEXUSUK",
    from: "GBP",
    to: "USD",
    invertSourceRate: false,
    sourceUnits: "U.S. Dollars to One U.K. Pound Sterling",
  },
  {
    seriesId: "DEXUSUK",
    from: "USD",
    to: "GBP",
    invertSourceRate: true,
    sourceUnits: "U.S. Dollars to One U.K. Pound Sterling",
  },
  {
    seriesId: "DEXUSAL",
    from: "AUD",
    to: "USD",
    invertSourceRate: false,
    sourceUnits: "U.S. Dollars to One Australian Dollar",
  },
  {
    seriesId: "DEXUSAL",
    from: "USD",
    to: "AUD",
    invertSourceRate: true,
    sourceUnits: "U.S. Dollars to One Australian Dollar",
  },
  {
    seriesId: "DEXJPUS",
    from: "USD",
    to: "JPY",
    invertSourceRate: false,
    sourceUnits: "Japanese Yen to One U.S. Dollar",
  },
  {
    seriesId: "DEXJPUS",
    from: "JPY",
    to: "USD",
    invertSourceRate: true,
    sourceUnits: "Japanese Yen to One U.S. Dollar",
  },
  {
    seriesId: "DEXCAUS",
    from: "USD",
    to: "CAD",
    invertSourceRate: false,
    sourceUnits: "Canadian Dollars to One U.S. Dollar",
  },
  {
    seriesId: "DEXCAUS",
    from: "CAD",
    to: "USD",
    invertSourceRate: true,
    sourceUnits: "Canadian Dollars to One U.S. Dollar",
  },
  {
    seriesId: "DEXSZUS",
    from: "USD",
    to: "CHF",
    invertSourceRate: false,
    sourceUnits: "Swiss Francs to One U.S. Dollar",
  },
  {
    seriesId: "DEXSZUS",
    from: "CHF",
    to: "USD",
    invertSourceRate: true,
    sourceUnits: "Swiss Francs to One U.S. Dollar",
  },
  {
    seriesId: "DEXCHUS",
    from: "USD",
    to: "CNY",
    invertSourceRate: false,
    sourceUnits: "Chinese Yuan Renminbi to One U.S. Dollar",
  },
  {
    seriesId: "DEXCHUS",
    from: "CNY",
    to: "USD",
    invertSourceRate: true,
    sourceUnits: "Chinese Yuan Renminbi to One U.S. Dollar",
  },
  {
    seriesId: "DEXMXUS",
    from: "USD",
    to: "MXN",
    invertSourceRate: false,
    sourceUnits: "Mexican Pesos to One U.S. Dollar",
  },
  {
    seriesId: "DEXMXUS",
    from: "MXN",
    to: "USD",
    invertSourceRate: true,
    sourceUnits: "Mexican Pesos to One U.S. Dollar",
  },
  {
    seriesId: "DEXINUS",
    from: "USD",
    to: "INR",
    invertSourceRate: false,
    sourceUnits: "Indian Rupees to One U.S. Dollar",
  },
  {
    seriesId: "DEXINUS",
    from: "INR",
    to: "USD",
    invertSourceRate: true,
    sourceUnits: "Indian Rupees to One U.S. Dollar",
  },
  {
    seriesId: "DEXKOUS",
    from: "USD",
    to: "KRW",
    invertSourceRate: false,
    sourceUnits: "South Korean Won to One U.S. Dollar",
  },
  {
    seriesId: "DEXKOUS",
    from: "KRW",
    to: "USD",
    invertSourceRate: true,
    sourceUnits: "South Korean Won to One U.S. Dollar",
  },
] as const satisfies readonly FredFxPairConfig[];

export function getFxEtlWindow(scheduledTimestamp: number): {
  observationStart: FxDateString;
  observationEnd: FxDateString;
} {
  const observationEnd = dateFromTimestamp(scheduledTimestamp);
  return {
    observationStart: subtractCalendarDays(
      observationEnd,
      FX_ETL_LOOKBACK_DAYS,
    ),
    observationEnd,
  };
}

export function getUniqueFredSeriesIds(
  pairConfigs: readonly FredFxPairConfig[] = FRED_COMMON_USD_FX_PAIR_CONFIGS,
): FredSeriesId[] {
  return [...new Set(pairConfigs.map((config) => config.seriesId))];
}

export async function fetchFredObservationSets(
  client: FredClient,
  options: FetchFredObservationSetsOptions,
): Promise<FredObservationFetchResult> {
  const pairConfigs = options.pairConfigs ?? FRED_COMMON_USD_FX_PAIR_CONFIGS;
  const seriesIds = getUniqueFredSeriesIds(pairConfigs);

  const results = await Promise.all(
    seriesIds.map(async (seriesId) => {
      try {
        const response = await client.seriesObservations({
          seriesId,
          observationStart: options.observationStart,
          observationEnd: options.observationEnd,
          sortOrder: "asc",
        });

        return {
          ok: true as const,
          seriesId,
          observations: response.observations,
        };
      } catch (error) {
        return {
          ok: false as const,
          seriesId,
          message: errorToMessage(error),
        };
      }
    }),
  );

  return {
    sourceSeriesCount: seriesIds.length,
    observationStart: options.observationStart,
    observationEnd: options.observationEnd,
    series: results
      .filter((result) => result.ok)
      .map((result) => ({
        seriesId: result.seriesId,
        observations: result.observations,
      })),
    failures: results
      .filter((result) => !result.ok)
      .map((result) => ({
        seriesId: result.seriesId,
        message: result.message,
      })),
  };
}

export function buildFxSnapshotsFromFredObservationSets(
  observationSets: readonly FredObservationSet[],
  options: BuildFxSnapshotsOptions,
): FxRateSnapshot[] {
  const pairConfigs = options.pairConfigs ?? FRED_COMMON_USD_FX_PAIR_CONFIGS;
  const observationsBySeriesId = new Map(
    observationSets.map((observationSet) => [
      observationSet.seriesId,
      observationSet.observations,
    ]),
  );

  const snapshots: FxRateSnapshot[] = [];
  for (const pairConfig of pairConfigs) {
    const observations = observationsBySeriesId.get(pairConfig.seriesId);
    if (!observations) {
      continue;
    }

    const snapshot = buildFxSnapshotFromFredObservations(
      pairConfig,
      observations,
      options.generatedAt,
    );
    if (snapshot) {
      snapshots.push(snapshot);
    }
  }

  return snapshots;
}

function buildFxSnapshotFromFredObservations(
  pairConfig: FredFxPairConfig,
  observations: readonly FredSeriesObservation[],
  generatedAt: string,
): FxRateSnapshot | undefined {
  const rates: FxRateObservation[] = [];

  for (const observation of observations) {
    const rate = pairConfig.invertSourceRate
      ? invertDecimalString(observation.value)
      : normalizeDecimalString(observation.value);

    if (!rate) {
      continue;
    }

    rates.push({
      date: observation.date,
      rate,
    });
  }

  if (rates.length === 0) {
    return undefined;
  }

  return {
    schemaVersion: FX_SCHEMA_VERSION,
    from: pairConfig.from,
    to: pairConfig.to,
    rateScale: FX_RATE_SCALE,
    generatedAt,
    observationStart: rates[0].date,
    observationEnd: rates[rates.length - 1].date,
    rates,
  };
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function invertDecimalString(value: string): string | undefined {
  const normalized = normalizeDecimalString(value);
  if (!normalized) {
    return undefined;
  }

  const [whole, fractional = ""] = normalized.split(".");
  const numeratorDigits = `${whole}${fractional}`.replace(/^0+/, "") || "0";
  const numerator = BigInt(numeratorDigits);
  if (numerator === 0n) {
    return undefined;
  }

  const scaledNumerator = pow10(
    fractional.length + INVERTED_RATE_FRACTION_DIGITS,
  );
  let quotient = scaledNumerator / numerator;
  const remainder = scaledNumerator % numerator;
  if (remainder * 2n >= numerator) {
    quotient += 1n;
  }

  return formatScaledDecimal(quotient, INVERTED_RATE_FRACTION_DIGITS);
}

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

function formatScaledDecimal(value: bigint, fractionalDigits: number): string {
  if (fractionalDigits === 0) {
    return value.toString();
  }

  const raw = value.toString().padStart(fractionalDigits + 1, "0");
  const whole = raw.slice(0, -fractionalDigits);
  const fractional = raw.slice(-fractionalDigits).replace(/0+$/, "");
  return fractional.length > 0 ? `${whole}.${fractional}` : whole;
}
