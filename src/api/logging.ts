import { createMiddleware } from "hono/factory";

/**

 * @usage
 * app.use(loggingMiddleware)
 */
export const loggingMiddleware = createMiddleware(async (c, next) => {
  const apiVersion = c.get("apiVersion")?.toString() || null;
  const req = c.req;
  const start = Date.now();
  await next();
  const end = Date.now();
  const durationMs = end - start;
  const method = req.method;
  const path = req.path;
  const status = c.res.status;

  console.log(`${method} ${path} ${status} ${end - start}ms`, {
    surface: "api",
    durationMs: durationMs,
    timestamp: start,
    method: method,
    path: path,
    status: status,
    apiVersion: apiVersion,
    url: req.raw.url.toString(),
  });
});
