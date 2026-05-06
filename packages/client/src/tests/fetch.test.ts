import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeFetch } from "../fetch.js";
import { OidcError, type HttpRequest } from "oidc-js-core";

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

  it("RFC 6749 §5.2: throws OidcError with error code and description", async () => {
    vi.stubGlobal("fetch", mockFetch(
      { error: "invalid_grant", error_description: "Code expired" },
      400,
      "Bad Request",
    ));

    try {
      await executeFetch({ url: "https://auth.example.com/token", method: "POST", headers: {} });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OidcError);
      expect((e as OidcError).code).toBe("TOKEN_EXCHANGE_ERROR");
      expect((e as OidcError).message).toBe("invalid_grant: Code expired");
    }
  });

  it("RFC 6749 §5.2: throws OidcError with error code when no description", async () => {
    vi.stubGlobal("fetch", mockFetch(
      { error: "invalid_client" },
      401,
      "Unauthorized",
    ));

    try {
      await executeFetch({ url: "https://auth.example.com/token", method: "POST", headers: {} });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OidcError);
      expect((e as OidcError).code).toBe("TOKEN_EXCHANGE_ERROR");
      expect((e as OidcError).message).toBe("invalid_client");
    }
  });

  it("throws OidcError on non-OK response without JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("not json")),
    }));

    try {
      await executeFetch({ url: "https://auth.example.com/token", method: "POST", headers: {} });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OidcError);
      expect((e as OidcError).code).toBe("TOKEN_EXCHANGE_ERROR");
      expect((e as OidcError).message).toBe("HTTP 500: Internal Server Error");
    }
  });
});
