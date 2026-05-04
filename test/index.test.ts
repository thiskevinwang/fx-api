import { exports } from "cloudflare:workers";
import { describe, it, expect } from "vitest";

describe("API", () => {
  it("responds with not found and proper status for /404", async () => {
    const response = await exports.default.fetch("http://example.com/404");
    expect(response.status).toBe(404);
    expect(await response.text()).toMatchInlineSnapshot(
      `"{"error":{"type":"invalid_request_error","code":"not_found","message":"Endpoint not found"}}"`,
    );
  });

  it("responds with html for /", async () => {
    const response = await exports.default.fetch("http://example.com/");
    expect(response.status).toBe(200);
    expect(await response.text()).toMatchFileSnapshot("./index.snapshot.html");
  });
});
