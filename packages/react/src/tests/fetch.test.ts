import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeFetch } from "../fetch.js";
import type { HttpRequest } from "oidc-js-core";

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(body: unknown, status = 200, statusText = "OK") {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  });
}

describe("executeFetch", () => {
  it("calls fetch with correct url, method, headers, and body", async () => {
    const fetchMock = mockFetch({ result: "ok" });
    vi.stubGlobal("fetch", fetchMock);

    const request: HttpRequest = {
      url: "https://auth.example.com/token",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=authorization_code",
    };

    await executeFetch(request);

    expect(fetchMock).toHaveBeenCalledWith("https://auth.example.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=authorization_code",
      signal: undefined,
    });
  });

  it("passes AbortSignal through to fetch", async () => {
    const fetchMock = mockFetch({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const controller = new AbortController();
    const request: HttpRequest = {
      url: "https://auth.example.com/userinfo",
      method: "GET",
      headers: {},
    };

    await executeFetch(request, controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      signal: controller.signal,
    }));
  });

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal("fetch", mockFetch({ access_token: "at_123" }));

    const result = await executeFetch({
      url: "https://auth.example.com/token",
      method: "POST",
      headers: {},
    });

    expect(result).toEqual({ access_token: "at_123" });
  });

  it("throws on non-OK response with OIDC error body", async () => {
    vi.stubGlobal("fetch", mockFetch(
      { error: "invalid_grant", error_description: "Code expired" },
      400,
      "Bad Request",
    ));

    await expect(
      executeFetch({ url: "https://auth.example.com/token", method: "POST", headers: {} }),
    ).rejects.toThrow("Token error: Code expired");
  });

  it("throws on non-OK response without JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("not json")),
    }));

    await expect(
      executeFetch({ url: "https://auth.example.com/token", method: "POST", headers: {} }),
    ).rejects.toThrow("HTTP 500: Internal Server Error");
  });
});
