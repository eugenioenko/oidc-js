import { test, expect } from "./autentico.fixture.js";
import type { Page } from "@playwright/test";

const IDP_PORT = process.env.E2E_IDP_PORT ?? "9999";
const APP_PORT = process.env.E2E_APP_PORT ?? "5173";
const FRAMEWORK = process.env.E2E_FRAMEWORK ?? "unknown";

const AUTENTICO_URL = `http://localhost:${IDP_PORT}`;
const TEST_USER = "testuser";
const TEST_PASS = "TestUser123!";
const TIMEOUT = 10_000;

const idpPattern = new RegExp(`localhost:${IDP_PORT}`);
const appPattern = new RegExp(`localhost:${APP_PORT}`);

type TrafficEntry = { method: string; path: string };

const OIDC_PATHS = [
  "/oauth2/.well-known/openid-configuration",
  "/oauth2/token",
  "/oauth2/userinfo",
  "/oauth2/authorize",
  "/oauth2/logout",
];

function trackTraffic(page: Page) {
  const log: TrafficEntry[] = [];
  const navs: string[] = [];
  const sequence: string[] = [];

  page.on("request", (req) => {
    const type = req.resourceType();
    if (type !== "fetch" && type !== "xhr") return;
    const url = new URL(req.url());
    if (url.origin === AUTENTICO_URL && OIDC_PATHS.includes(url.pathname)) {
      log.push({ method: req.method(), path: url.pathname });
      sequence.push(`${req.method()} ${url.pathname}`);
    }
  });

  page.on("request", (req) => {
    if (req.resourceType() !== "document") return;
    const url = new URL(req.url());
    if (url.origin === AUTENTICO_URL && OIDC_PATHS.includes(url.pathname)) {
      navs.push(url.pathname);
      sequence.push(`NAV ${url.pathname}`);
    }
  });

  return {
    requests: () => log.map((e) => `${e.method} ${e.path}`),
    navigations: () => navs,
    sequence: () => sequence,
  };
}

async function login(page: Page) {
  await page.goto("/");
  await page.getByTestId("login-button").click();
  await page.waitForURL(idpPattern);
  await page.fill('input[name="username"]', TEST_USER);
  await page.fill('input[name="password"]', TEST_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(appPattern, { timeout: TIMEOUT });
  await expect(page.getByTestId("authenticated")).toBeVisible({ timeout: TIMEOUT });
}

async function revokeToken(token: string, hint?: string) {
  const body: Record<string, string> = { token, client_id: "e2e-test-app" };
  if (hint) body.token_type_hint = hint;
  const res = await fetch(`${AUTENTICO_URL}/oauth2/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) {
    throw new Error(`Revoke failed: ${res.status} ${await res.text()}`);
  }
}

const GET_WELLKNOWN = "GET /oauth2/.well-known/openid-configuration";
const POST_TOKEN = "POST /oauth2/token";
const GET_USERINFO = "GET /oauth2/userinfo";
const NAV_AUTHORIZE = "NAV /oauth2/authorize";
const NAV_LOGOUT = "NAV /oauth2/logout";

const LOGIN_REQUESTS = [
  GET_WELLKNOWN,
  GET_WELLKNOWN,
  POST_TOKEN,
  GET_USERINFO,
];

const LOGIN_NAVIGATIONS = [
  "/oauth2/authorize",
];

const LOGIN_SEQUENCE = [
  GET_WELLKNOWN,
  NAV_AUTHORIZE,
  GET_WELLKNOWN,
  POST_TOKEN,
  GET_USERINFO,
];

test.describe(`[${FRAMEWORK}] OIDC Login Flow`, () => {
  test("shows login button when not authenticated", async ({ page }) => {
    const traffic = trackTraffic(page);
    await page.goto("/");
    await expect(page.getByTestId("unauthenticated")).toBeVisible();
    await expect(page.getByTestId("login-button")).toBeVisible();

    expect(traffic.requests()).toEqual([
      GET_WELLKNOWN,
    ]);
    expect(traffic.navigations()).toEqual([]);
    expect(traffic.sequence()).toEqual([
      GET_WELLKNOWN,
    ]);
  });

  test("completes full login flow with tokens", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);
    await expect(page.getByTestId("access-token")).toHaveText("present");
    await expect(page.getByTestId("refresh-token")).toHaveText("present");
    await expect(page.getByTestId("id-token")).toHaveText("present");

    expect(traffic.requests()).toEqual(LOGIN_REQUESTS);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
    expect(traffic.sequence()).toEqual(LOGIN_SEQUENCE);
  });

  test("user.claims has required OIDC fields", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);
    await expect(page.getByTestId("user-sub")).not.toBeEmpty();
    await expect(page.getByTestId("user-iss")).toHaveText(`${AUTENTICO_URL}/oauth2`);
    await expect(page.getByTestId("user-aud")).not.toBeEmpty();
    await expect(page.getByTestId("user-exp")).not.toBeEmpty();
    await expect(page.getByTestId("user-iat")).not.toBeEmpty();

    expect(traffic.requests()).toEqual(LOGIN_REQUESTS);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
    expect(traffic.sequence()).toEqual(LOGIN_SEQUENCE);
  });

  test("user.profile is populated when fetchProfile is true", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);
    await expect(page.getByTestId("user-email")).toHaveText("testuser@test.com");
    await expect(page.getByTestId("user-profile-null")).toHaveText("false");

    expect(traffic.requests()).toEqual(LOGIN_REQUESTS);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
    expect(traffic.sequence()).toEqual(LOGIN_SEQUENCE);
  });

  test("user.profile is null when fetchProfile is false", async ({ page }) => {
    const traffic = trackTraffic(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.setItem("e2e-fetchProfile", "false"));
    await page.reload();
    await page.getByTestId("login-button").click();
    await page.waitForURL(idpPattern);
    await page.fill('input[name="username"]', TEST_USER);
    await page.fill('input[name="password"]', TEST_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(appPattern);
    await expect(page.getByTestId("authenticated")).toBeVisible();
    await expect(page.getByTestId("user-profile-null")).toHaveText("true");
    await expect(page.getByTestId("user-email")).toHaveText("no profile");
    await page.evaluate(() => localStorage.removeItem("e2e-fetchProfile"));

    expect(traffic.requests()).toEqual([
      GET_WELLKNOWN,
      GET_WELLKNOWN,
      GET_WELLKNOWN,
      POST_TOKEN,
    ]);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
    expect(traffic.sequence()).toEqual([
      GET_WELLKNOWN,
      GET_WELLKNOWN,
      NAV_AUTHORIZE,
      GET_WELLKNOWN,
      POST_TOKEN,
    ]);
  });

  test("logout clears state", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);
    await page.getByTestId("logout-button").click();
    await expect(page.getByTestId("unauthenticated")).toBeVisible({ timeout: TIMEOUT });
    await page.goto("/");
    await expect(page.getByTestId("unauthenticated")).toBeVisible();

    expect(traffic.requests()).toEqual([
      ...LOGIN_REQUESTS,
      GET_WELLKNOWN,
      GET_WELLKNOWN,
    ]);
    expect(traffic.navigations()).toEqual([
      ...LOGIN_NAVIGATIONS,
      "/oauth2/logout",
    ]);
    expect(traffic.sequence()).toEqual([
      ...LOGIN_SEQUENCE,
      NAV_LOGOUT,
      GET_WELLKNOWN,
      GET_WELLKNOWN,
    ]);
  });

  test("manual token refresh", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);
    const oldToken = await page.getByTestId("access-token-value").textContent();
    await page.getByTestId("refresh-button").click();
    await expect(page.getByTestId("access-token-value")).not.toHaveText(oldToken!, { timeout: TIMEOUT });

    expect(traffic.requests()).toEqual([
      ...LOGIN_REQUESTS,
      POST_TOKEN,
      GET_USERINFO,
    ]);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
    expect(traffic.sequence()).toEqual([
      ...LOGIN_SEQUENCE,
      POST_TOKEN,
      GET_USERINFO,
    ]);
  });
});

test.describe(`[${FRAMEWORK}] Session Lifecycle`, () => {
  test("cleans callback URL params after login", async ({ page }) => {
    await login(page);
    const url = new URL(page.url());
    expect(url.searchParams.has("code")).toBe(false);
    expect(url.searchParams.has("state")).toBe(false);
  });

  test("loses session on page reload (in-memory only)", async ({ page }) => {
    await login(page);
    await expect(page.getByTestId("authenticated")).toBeVisible();

    await page.reload();

    await expect(page.getByTestId("unauthenticated")).toBeVisible({ timeout: TIMEOUT });
  });

  test("completes multiple login/logout cycles without stale state", async ({ page }) => {
    await login(page);
    await expect(page.getByTestId("authenticated")).toBeVisible();

    await page.getByTestId("logout-button").click();
    await expect(page.getByTestId("unauthenticated")).toBeVisible({ timeout: TIMEOUT });

    await page.getByTestId("login-button").click();
    await page.waitForURL(idpPattern);
    await page.fill('input[name="username"]', TEST_USER);
    await page.fill('input[name="password"]', TEST_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(appPattern, { timeout: TIMEOUT });
    await expect(page.getByTestId("authenticated")).toBeVisible({ timeout: TIMEOUT });
    await expect(page.getByTestId("access-token")).toHaveText("present");
  });

  test("recovers from error state with fresh login", async ({ page }) => {
    await page.goto("/?error=access_denied&error_description=User+denied+consent");
    await expect(page.getByTestId("auth-error")).toBeVisible();

    await page.goto("/");
    await login(page);
    await expect(page.getByTestId("authenticated")).toBeVisible();
    await expect(page.getByTestId("access-token")).toHaveText("present");
  });
});

test.describe(`[${FRAMEWORK}] Security`, () => {
  test("tokens are not stored in localStorage or sessionStorage", async ({ page }) => {
    await login(page);

    const storedTokens = await page.evaluate(() => {
      const storage: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        storage.push(localStorage.key(i) + "=" + localStorage.getItem(localStorage.key(i)!));
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        storage.push(sessionStorage.key(i) + "=" + sessionStorage.getItem(sessionStorage.key(i)!));
      }
      return storage.join("\n");
    });

    expect(storedTokens).not.toContain("access_token");
    expect(storedTokens).not.toContain("refresh_token");
    expect(storedTokens).not.toContain("id_token");
  });

  test("back button after logout does not show authenticated content", async ({ page }) => {
    await login(page);
    await expect(page.getByTestId("authenticated")).toBeVisible();

    await page.getByTestId("logout-button").click();
    await expect(page.getByTestId("unauthenticated")).toBeVisible({ timeout: TIMEOUT });

    await page.goBack();

    await expect(page.getByTestId("authenticated")).not.toBeVisible({ timeout: TIMEOUT });
  });
});

test.describe(`[${FRAMEWORK}] Error Handling`, () => {
  test("shows error when IdP returns error in callback", async ({ page }) => {
    const traffic = trackTraffic(page);
    await page.goto("/?error=access_denied&error_description=User+denied+consent");
    await expect(page.getByTestId("auth-error")).toBeVisible();
    await expect(page.getByTestId("auth-error")).toContainText("User denied consent");

    expect(traffic.requests()).toEqual([
      GET_WELLKNOWN,
    ]);
    expect(traffic.navigations()).toEqual([]);
    expect(traffic.sequence()).toEqual([
      GET_WELLKNOWN,
    ]);
  });

  test("shows error when callback state does not match (CSRF protection)", async ({ page }) => {
    const traffic = trackTraffic(page);
    await page.goto("/");

    await page.evaluate((appPort) => {
      sessionStorage.setItem("oidc-js:auth-state", JSON.stringify({
        codeVerifier: "fake-verifier",
        state: "correct-state",
        nonce: "fake-nonce",
        redirectUri: `http://localhost:${appPort}/callback`,
      }));
    }, APP_PORT);

    await page.goto("/?code=fake-code&state=tampered-state");
    await expect(page.getByTestId("auth-error")).toBeVisible({ timeout: TIMEOUT });
    await expect(page.getByTestId("auth-error")).toContainText("State");

    expect(traffic.requests()).toEqual([
      GET_WELLKNOWN,
      GET_WELLKNOWN,
    ]);
    expect(traffic.navigations()).toEqual([]);
    expect(traffic.sequence()).toEqual([
      GET_WELLKNOWN,
      GET_WELLKNOWN,
    ]);
  });
});

test.describe(`[${FRAMEWORK}] Deep Linking`, () => {
  test("login from protected page returns to that page", async ({ page }) => {
    const traffic = trackTraffic(page);
    await page.goto("/protected-a", { waitUntil: "networkidle" });

    await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: TIMEOUT });
    await page.fill('input[name="username"]', TEST_USER);
    await page.fill('input[name="password"]', TEST_PASS);
    await page.click('button[type="submit"]');

    await expect(page.getByTestId("protected-a")).toBeVisible({ timeout: TIMEOUT });
    expect(page.url()).toContain("/protected-a");

    expect(traffic.requests()).toEqual(LOGIN_REQUESTS);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
    expect(traffic.sequence()).toEqual(LOGIN_SEQUENCE);
  });
});

test.describe(`[${FRAMEWORK}] RequireAuth`, () => {
  test("shows protected content when authenticated", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);
    await page.getByTestId("link-protected-a").click();
    await expect(page.getByTestId("protected-a")).toBeVisible();

    expect(traffic.requests()).toEqual(LOGIN_REQUESTS);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
    expect(traffic.sequence()).toEqual(LOGIN_SEQUENCE);
  });

  test("navigates between protected pages without re-authentication", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);
    await page.getByTestId("link-protected-a").click();
    await expect(page.getByTestId("protected-a")).toBeVisible();

    await page.getByTestId("link-protected-b").click();
    await expect(page.getByTestId("protected-b")).toBeVisible();

    await page.getByTestId("link-protected-a").click();
    await expect(page.getByTestId("protected-a")).toBeVisible();

    await page.getByTestId("link-home").click();
    await expect(page.getByTestId("authenticated")).toBeVisible();

    expect(traffic.requests()).toEqual(LOGIN_REQUESTS);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
    expect(traffic.sequence()).toEqual(LOGIN_SEQUENCE);
  });

  test("auto-refreshes expired token when navigating to protected page", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);
    const expiresAt = Number(await page.getByTestId("expires-at").textContent());

    await page.getByTestId("link-protected-a").click();
    await expect(page.getByTestId("protected-a")).toBeVisible();

    await page.evaluate((exp) => {
      const realDateNow = Date.now;
      const originalFetch = window.fetch;
      Date.now = () => exp + 1;
      window.fetch = function (...args: Parameters<typeof fetch>) {
        return originalFetch.apply(window, args).then((response) => {
          if (new URL(response.url).pathname === "/oauth2/token") {
            Date.now = realDateNow;
            window.fetch = originalFetch;
          }
          return response;
        });
      } as typeof fetch;
    }, expiresAt);

    await page.getByTestId("link-protected-b").click();
    await expect(page.getByTestId("protected-b")).toBeVisible({ timeout: TIMEOUT });

    expect(traffic.requests()).toEqual([
      ...LOGIN_REQUESTS,
      POST_TOKEN,
      GET_USERINFO,
    ]);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
    expect(traffic.sequence()).toEqual([
      ...LOGIN_SEQUENCE,
      POST_TOKEN,
      GET_USERINFO,
    ]);
  });

  test("redirects to login when refresh token is revoked", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);

    const refreshToken = await page.getByTestId("refresh-token-value").textContent();
    const expiresAt = Number(await page.getByTestId("expires-at").textContent());

    await page.getByTestId("link-protected-a").click();
    await expect(page.getByTestId("protected-a")).toBeVisible();

    await revokeToken(refreshToken!, "refresh_token");

    await page.evaluate((exp) => {
      const realDateNow = Date.now;
      const originalFetch = window.fetch;
      Date.now = () => exp + 1;
      window.fetch = function (...args: Parameters<typeof fetch>) {
        return originalFetch.apply(window, args).then((response) => {
          if (new URL(response.url).pathname === "/oauth2/token") {
            Date.now = realDateNow;
            window.fetch = originalFetch;
          }
          return response;
        });
      } as typeof fetch;
    }, expiresAt);

    await page.getByTestId("link-protected-b").click();
    await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: TIMEOUT });

    expect(traffic.requests()).toEqual([
      ...LOGIN_REQUESTS,
      POST_TOKEN,
    ]);
    expect(traffic.navigations()).toEqual([
      ...LOGIN_NAVIGATIONS,
      "/oauth2/authorize",
    ]);
    expect(traffic.sequence()).toEqual([
      ...LOGIN_SEQUENCE,
      POST_TOKEN,
      NAV_AUTHORIZE,
    ]);
  });
});

test.describe(`[${FRAMEWORK}] Nonce Validation`, () => {
  test("rejects token when nonce is tampered (replay protection)", async ({ page }) => {
    const traffic = trackTraffic(page);

    await page.addInitScript(() => {
      const stored = sessionStorage.getItem("oidc-js:auth-state");
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.nonce = "tampered-nonce";
        sessionStorage.setItem("oidc-js:auth-state", JSON.stringify(parsed));
      }
    });

    await page.goto("/");
    await page.getByTestId("login-button").click();
    await page.waitForURL(idpPattern);
    await page.fill('input[name="username"]', TEST_USER);
    await page.fill('input[name="password"]', TEST_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(appPattern, { timeout: TIMEOUT });

    await expect(page.getByTestId("auth-error")).toBeVisible({ timeout: TIMEOUT });
    await expect(page.getByTestId("auth-error")).toContainText("nonce", { ignoreCase: true });

    expect(traffic.sequence()).toEqual([
      GET_WELLKNOWN,
      NAV_AUTHORIZE,
      GET_WELLKNOWN,
      POST_TOKEN,
    ]);
  });
});

test.describe(`[${FRAMEWORK}] PKCE Security`, () => {
  test("generates unique state, nonce, and code_challenge for each login", async ({ page }) => {
    const authParams: URLSearchParams[] = [];
    page.on("request", (req) => {
      if (req.resourceType() !== "document") return;
      const url = new URL(req.url());
      if (url.origin === AUTENTICO_URL && url.pathname === "/oauth2/authorize") {
        authParams.push(new URLSearchParams(url.search));
      }
    });

    await login(page);
    await page.getByTestId("logout-button").click();
    await expect(page.getByTestId("unauthenticated")).toBeVisible({ timeout: TIMEOUT });

    await login(page);

    expect(authParams).toHaveLength(2);
    expect(authParams[0].get("state")).toBeTruthy();
    expect(authParams[1].get("state")).toBeTruthy();
    expect(authParams[0].get("state")).not.toBe(authParams[1].get("state"));

    expect(authParams[0].get("code_challenge")).toBeTruthy();
    expect(authParams[1].get("code_challenge")).toBeTruthy();
    expect(authParams[0].get("code_challenge")).not.toBe(authParams[1].get("code_challenge"));

    expect(authParams[0].get("nonce")).toBeTruthy();
    expect(authParams[1].get("nonce")).toBeTruthy();
    expect(authParams[0].get("nonce")).not.toBe(authParams[1].get("nonce"));
  });
});

test.describe(`[${FRAMEWORK}] Refresh Deduplication`, () => {
  test("concurrent refresh calls produce only one token request", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);
    const oldToken = await page.getByTestId("access-token-value").textContent();

    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="refresh-button"]')!;
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await expect(page.getByTestId("access-token-value")).not.toHaveText(oldToken!, { timeout: TIMEOUT });

    const postLoginTokenRequests = traffic.requests()
      .slice(LOGIN_REQUESTS.length)
      .filter((r) => r === POST_TOKEN);
    expect(postLoginTokenRequests).toHaveLength(1);
  });
});

test.describe(`[${FRAMEWORK}] Token Revocation`, () => {
  test("handles revoked access token gracefully on userinfo fetch", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);

    const accessToken = await page.getByTestId("access-token-value").textContent();
    await revokeToken(accessToken!, "access_token");

    await page.getByTestId("fetch-profile-button").click();
    await page.waitForTimeout(1000);

    await expect(page.getByTestId("authenticated")).toBeVisible();

    const postLoginRequests = traffic.requests().slice(LOGIN_REQUESTS.length);
    expect(postLoginRequests).toContain(GET_USERINFO);
  });

  test("manual refresh obtains new tokens after normal expiry", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);

    const oldToken = await page.getByTestId("access-token-value").textContent();
    await page.getByTestId("refresh-button").click();
    await expect(page.getByTestId("access-token-value")).not.toHaveText(oldToken!, { timeout: TIMEOUT });

    await page.getByTestId("fetch-profile-button").click();
    await page.waitForTimeout(1000);
    await expect(page.getByTestId("authenticated")).toBeVisible();

    const postLoginSequence = traffic.sequence().slice(LOGIN_SEQUENCE.length);
    expect(postLoginSequence).toEqual([
      POST_TOKEN,
      GET_USERINFO,
      GET_USERINFO,
    ]);
  });
});

test.describe(`[${FRAMEWORK}] Concurrent Tabs`, () => {
  test("concurrent logins in separate tabs do not interfere", async ({ page, context }) => {
    const page2 = await context.newPage();

    await page.goto("/");
    await page.getByTestId("login-button").click();
    await page.waitForURL(idpPattern);

    await page2.goto(`http://localhost:${APP_PORT}/`);
    await page2.getByTestId("login-button").click();
    await page2.waitForURL(idpPattern);

    await page.fill('input[name="username"]', TEST_USER);
    await page.fill('input[name="password"]', TEST_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(appPattern, { timeout: TIMEOUT });
    await expect(page.getByTestId("authenticated")).toBeVisible({ timeout: TIMEOUT });

    await page2.fill('input[name="username"]', TEST_USER);
    await page2.fill('input[name="password"]', TEST_PASS);
    await page2.click('button[type="submit"]');
    await page2.waitForURL(appPattern, { timeout: TIMEOUT });
    await expect(page2.getByTestId("authenticated")).toBeVisible({ timeout: TIMEOUT });

    await expect(page.getByTestId("access-token")).toHaveText("present");
    await expect(page2.getByTestId("access-token")).toHaveText("present");

    await page2.close();
  });
});
