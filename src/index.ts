import {
  WorkerEntrypoint,
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";

import { Hono } from "hono";

const FAKE_FILE = "2000-12-20";

type Params = {
  createdTimestamp: number;
};

type WorkflowLogLine = {
  event?: WorkflowEvent<Params>;
  steps: unknown[];
};

// INPUT: timestamp
// OUTPUT: none
// SIDE EFFECTS: fetch observations from FRED, persist to bucket
export class MyWorkflow extends WorkflowEntrypoint<Env, Params> {
  private readonly logline: WorkflowLogLine = { steps: [] };

  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    this.logline.event = event;
    await step.do("fetch_data", async (ctx) => {
      console.log("workflow.step", {
        surface: "workflow",
        step_name: ctx.step.name,
        step_count: ctx.step.count,
        attempt: ctx.config,
      });
      return "ok";
    });
    await step.do("persist_data", async (ctx) => {
      this.logline.steps.push(ctx);
      const randomJson = { foo: "bar" };
      await this.env.STATIC_FILES.put(FAKE_FILE, JSON.stringify(randomJson));
      return "ok";
    });
    console.log("workflow.done", this.logline);
  }
}

const apiHandler = new Hono<{ Bindings: Env }>()
  .use(async (c, next) => {
    const now = new Date().toISOString();
    await next();
    console.log("api", {
      request: {
        host: c.req.header("Host"),
        method: c.req.method,
        path: c.req.path,
      },
      response: {
        status: c.res.status,
      },
      surface: "api",
      timestamp: now,
    });
  })
  .notFound((c) => {
    return c.json({}, 404);
  })
  .onError((err, c) => {
    return c.json({}, 500);
  }).fetch;

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
  let instance = await env.MY_WORKFLOW.create({
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
    return apiHandler(request, this.env, this.ctx);
  }
}
