import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: "./wrangler.jsonc",
        environment: "test",
      },
      miniflare: {
        compatibilityFlags: [
          // See example: https://github.com/cloudflare/workers-sdk/blob/main/fixtures/vitest-pool-workers-examples/basics-integration-auxiliary/vitest.config.ts#L20
          // Required to use `WORKER.scheduled()`. This is an experimental
          // compatibility flag, and cannot be enabled in production.
          "service_binding_extra_handlers",
        ],
      },
    }),
  ],
});
