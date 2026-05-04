import { describe, it, expect, vi } from "vitest";
import { introspectWorkflow } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";

// See test docs: https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/#workflows
// See schedule example: https://github.com/cloudflare/workers-sdk/blob/main/fixtures/vitest-pool-workers-examples/basics-unit-integration-self/test/scheduled-integration-self.test.ts
// See workflow example: https://github.com/cloudflare/workers-sdk/blob/main/fixtures/vitest-pool-workers-examples/workflows/test/integration.test.ts#L13
describe("Workflow", () => {
  it("runs", async (ctx) => {
    const originalFetch = globalThis.fetch;
    const requestedSeriesIds: string[] = [];
    const fredFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(requestUrl(input));

        if (
          url.origin !== "https://api.stlouisfed.org" ||
          url.pathname !== "/fred/series/observations"
        ) {
          throw new Error(`Unexpected global fetch in test: ${url.toString()}`);
        }

        expect(init?.method).toBe("GET");

        const seriesId = url.searchParams.get("series_id");
        expect(seriesId).toBeTruthy();
        requestedSeriesIds.push(seriesId ?? "");

        return Response.json(
          fredSeriesObservationsResponse({
            observationStart:
              url.searchParams.get("observation_start") ?? "2025-12-31",
            observationEnd:
              url.searchParams.get("observation_end") ?? "2026-01-01",
          }),
        );
      },
    );
    globalThis.fetch = fredFetch as typeof fetch;
    ctx.onTestFinished(() => {
      globalThis.fetch = originalFetch;
    });

    // Create a workflow introspector. Must be instantiated before workflows
    // are invoked by the schedule handler. ID's are not known.
    await using introspector = await introspectWorkflow(env.MY_WORKFLOW);
    await introspector.modifyAll(async (m) => {
      await m.disableSleeps();
    });

    const result = await exports.default.scheduled({
      // @ts-ignore
      scheduledTime: new Date("2026-01-01T01:00:00.000Z"),
      // cron: "30 * * * *",
      cron: "0 1 * * *",
    });
    // @ts-ignore
    expect(result.outcome).toEqual("ok");

    const instances = introspector.get();
    expect(instances.length).toBe(1);

    const [instance] = instances;
    await instance.waitForStatus("complete");
    expect(fredFetch).toHaveBeenCalledTimes(10);

    expect(requestedSeriesIds.length).toBe(10);
    expect(requestedSeriesIds).toMatchInlineSnapshot(`
      [
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
      ]
    `);
  });
});

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}

function fredSeriesObservationsResponse(options: {
  observationStart: string;
  observationEnd: string;
}) {
  return {
    realtime_start: options.observationEnd,
    realtime_end: options.observationEnd,
    observation_start: options.observationStart,
    observation_end: options.observationEnd,
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
        realtime_start: options.observationEnd,
        realtime_end: options.observationEnd,
        date: options.observationEnd,
        value: "1.25",
      },
    ],
  };
}
