import {
  WorkerEntrypoint,
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";

import { createFxApiApp } from "./lib/fx-api";
import { buildFxManifest, summarizeFxSnapshots } from "./lib/fx";
import {
  buildFxSnapshotsFromFredObservationSets,
  fetchFredObservationSets,
  getFxEtlWindow,
} from "./lib/fx-etl";
import { FredClient } from "./lib/fred";
import { writeFxSnapshotsAndManifest } from "./lib/fx-storage";

type Params = {
  createdTimestamp: number;
};

// INPUT: timestamp
// OUTPUT: summary logs
// SIDE EFFECTS: fetch observations from FRED, persist FX snapshots to R2
export class MyWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const generatedAt = new Date().toISOString();
    const etlWindow = getFxEtlWindow(event.payload.createdTimestamp);

    console.log("workflow.start", {
      surface: "workflow",
      instanceId: event.instanceId,
      scheduledTime: event.payload.createdTimestamp,
      observationStart: etlWindow.observationStart,
      observationEnd: etlWindow.observationEnd,
    });

    const fredFetch = await step.do("fetch_fred_observations", async () => {
      const fred = new FredClient(this.env.FRED_API_KEY);
      const result = await fetchFredObservationSets(fred, etlWindow);

      if (result.failures.length > 0) {
        console.error("workflow.fred_fetch_failed", {
          surface: "workflow",
          sourceSeriesCount: result.sourceSeriesCount,
          successfulSourceSeriesCount: result.series.length,
          failureCount: result.failures.length,
          failures: result.failures,
          observationStart: result.observationStart,
          observationEnd: result.observationEnd,
        });
        throw new Error(
          `FRED fetch failed for ${result.failures.length} source series`,
        );
      }

      return result;
    });

    console.log("workflow.fred_fetch_done", {
      surface: "workflow",
      sourceSeriesCount: fredFetch.sourceSeriesCount,
      successfulSourceSeriesCount: fredFetch.series.length,
      failureCount: fredFetch.failures.length,
      failures: fredFetch.failures,
      observationStart: fredFetch.observationStart,
      observationEnd: fredFetch.observationEnd,
    });

    const snapshots = await step.do("normalize_fx_snapshots", async () => {
      return buildFxSnapshotsFromFredObservationSets(fredFetch.series, {
        generatedAt,
      });
    });

    if (snapshots.length === 0) {
      throw new Error("No FX snapshots were generated");
    }

    const manifest = buildFxManifest(snapshots, generatedAt);
    const snapshotSummary = summarizeFxSnapshots(snapshots);

    await step.do("persist_fx_snapshots", async () => {
      await writeFxSnapshotsAndManifest(
        this.env.STATIC_FILES,
        snapshots,
        manifest,
      );
      return {
        pairCount: manifest.pairs.length,
        snapshotCount: snapshots.length,
      };
    });

    console.log("workflow.done", {
      surface: "workflow",
      sourceSeriesCount: fredFetch.sourceSeriesCount,
      pairCount: manifest.pairs.length,
      snapshotCount: snapshots.length,
      rateCount: snapshotSummary.rateCount,
      observationStart: snapshotSummary.observationStart,
      observationEnd: snapshotSummary.observationEnd,
      failureCount: fredFetch.failures.length,
    });
  }
}

const apiApp = createFxApiApp();

const cronHandler: ExportedHandlerScheduledHandler<Env> = async (
  controller,
  env,
  _,
) => {
  console.log("schedule.start", {
    surface: "scheduled",
    cron: controller.cron,
    scheduledTime: controller.scheduledTime,
  });
  const instance = await env.MY_WORKFLOW.create({
    params: {
      createdTimestamp: controller.scheduledTime,
    },
  });
  console.log("schedule.workflow_created", {
    surface: "scheduled",
    cron: controller.cron,
    scheduledTime: controller.scheduledTime,
    instance: instance.id,
  });
};

export default class extends WorkerEntrypoint<Env> {
  scheduled(controller: ScheduledController) {
    return cronHandler(controller, this.env, this.ctx);
  }

  fetch(request: Request) {
    return apiApp.fetch(request, this.env, this.ctx);
  }
}
