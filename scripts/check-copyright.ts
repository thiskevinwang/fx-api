#!/usr/bin/env bun

interface FredSeriesMetadataResponse {
  seriess?: Array<{
    title?: string;
    observation_start?: string;
    observation_end?: string;
    frequency?: string;
    units?: string;
    source?: string;
    notes?: string;
  }>;
}

const ids = [
  "DEXUSEU",
  "DEXUSUK",
  "DEXUSAL",
  "DEXJPUS",
  "DEXCAUS",
  "DEXSZUS",
  "DEXCHUS",
  "DEXMXUS",
  "DEXINUS",
  "DEXKOUS",
];

const apiKey = process.env.FRED_API_KEY;
if (!apiKey) {
  throw new Error("FRED_API_KEY missing");
}

for (const id of ids) {
  const url = new URL("https://api.stlouisfed.org/fred/series");
  url.searchParams.set("series_id", id);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");

  const response = await fetch(url);
  if (!response.ok) {
    console.log(
      JSON.stringify({
        id,
        error: `${response.status} ${response.statusText}`,
      }),
    );
    continue;
  }

  const json = (await response.json()) as FredSeriesMetadataResponse;
  const series = json.seriess?.[0];
  const notes = series?.notes ?? "";

  console.log(
    JSON.stringify({
      id,
      title: series?.title,
      observation_start: series?.observation_start,
      observation_end: series?.observation_end,
      frequency: series?.frequency,
      units: series?.units,
      source: series?.source,
      notes,
      hasCopyright: /copyright/i.test(notes),
    }),
  );
}

export {};
