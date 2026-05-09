import { type Context } from "hono";
import { createMiddleware } from "hono/factory";

const apiVersion20260505 = "2026-05-05.beta";
const DEFAULT_VERSION = apiVersion20260505;

const availableVersions = {
  [apiVersion20260505]: true,
} as const;

type Env = {
  Variables: {
    apiVersion: string;
    serialize: (
      c: Context,
      req: Request,
      err: Error | any,
    ) => Promise<Response>;
  };
};

const REQ_HEADER_KEY = "Api-Version";
const RES_HEADER_KEY = "Api-Version";

/**
 * @example
 * const app = new Hono()
 * app.use("/v1/*", apiVersionMiddleware)
 */
export const apiVersionMiddleware = createMiddleware<Env>(async (c, next) => {
  // parse version if present
  const suppliedVersion = c.req.header(REQ_HEADER_KEY);
  // validate structure
  // TODO: zod regex validate. 400 if invalid

  // validate version
  if (suppliedVersion) {
    // @ts-expect-error - ignore no-index-signature
    const resolvedVersion = availableVersions[suppliedVersion];
    if (!resolvedVersion) {
      // TODO: fill out error
      return c.json({}, 400);
    }

    c.set("apiVersion", resolvedVersion);
    c.header(RES_HEADER_KEY, resolvedVersion);
    return next();
  }
  // set version if not specified
  c.set("apiVersion", DEFAULT_VERSION);
  c.header(RES_HEADER_KEY, DEFAULT_VERSION);
  return next();
});

/**
 * Sets a api-versioned `serialize` on hono the request context
 */
export const setSerializerMiddleware = createMiddleware<Env>(
  async (c, next) => {
    const apiVersion = c.get("apiVersion");
    return next();
  },
);
