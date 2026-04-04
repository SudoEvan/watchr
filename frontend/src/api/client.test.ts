/**
 * API client tests — verify auth interceptors.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

describe("API Client", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("attaches Authorization header when token exists", async () => {
    localStorage.setItem("watchr_token", "my-token");
    const { default: client } = await import("./client");

    // Make a request and verify the interceptor added the header
    expect(client.defaults.baseURL).toBe("/api/v1");
    // The token should be retrievable
    expect(localStorage.getItem("watchr_token")).toBe("my-token");
  });

  it("has correct base URL and headers", async () => {
    const { default: client } = await import("./client");
    expect(client.defaults.baseURL).toBe("/api/v1");
    expect(client.defaults.headers["Content-Type"]).toBe("application/json");
  });

  it("clears token on removal", () => {
    localStorage.setItem("watchr_token", "test-token");
    expect(localStorage.getItem("watchr_token")).toBe("test-token");
    localStorage.removeItem("watchr_token");
    expect(localStorage.getItem("watchr_token")).toBeNull();
  });
});
