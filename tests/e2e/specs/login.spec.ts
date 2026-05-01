import { test, expect, type Page } from "@playwright/test";

const AUTENTICO_URL = "http://localhost:9999";
const TEST_USER = "testuser";
const TEST_PASS = "TestUser123!";

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

  page.on("request", (req) => {
    const type = req.resourceType();
    if (type !== "fetch" && type !== "xhr") return;
    const url = new URL(req.url());
    if (url.origin === AUTENTICO_URL && OIDC_PATHS.includes(url.pathname)) {
      log.push({ method: req.method(), path: url.pathname });
    }
  });

  page.on("request", (req) => {
    if (req.resourceType() !== "document") return;
    const url = new URL(req.url());
    if (url.origin === AUTENTICO_URL && OIDC_PATHS.includes(url.pathname)) {
      navs.push(url.pathname);
    }
  });

  return {
    requests: () => log.map((e) => `${e.method} ${e.path}`),
    navigations: () => navs,
  };
}

async function login(page: Page) {
  await page.goto("/");
  await page.getByTestId("login-button").click();
  await page.waitForURL(/localhost:9999/);
  await page.fill('input[name="username"]', TEST_USER);
  await page.fill('input[name="password"]', TEST_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/localhost:5173/);
  await expect(page.getByTestId("authenticated")).toBeVisible();
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

const DISCOVERY = "GET /oauth2/.well-known/openid-configuration";

const LOGIN_REQUESTS = [
  DISCOVERY,
  DISCOVERY,
  "POST /oauth2/token",
  "GET /oauth2/userinfo",
];

const LOGIN_NAVIGATIONS = [
  "/oauth2/authorize",
];

test.describe("OIDC Login Flow", () => {
  test("shows login button when not authenticated", async ({ page }) => {
    const traffic = trackTraffic(page);
    await page.goto("/");
    await expect(page.getByTestId("unauthenticated")).toBeVisible();
    await expect(page.getByTestId("login-button")).toBeVisible();

    expect(traffic.requests()).toEqual([
      DISCOVERY,
    ]);
    expect(traffic.navigations()).toEqual([]);
  });

  test("completes full login flow with tokens", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);
    await expect(page.getByTestId("access-token")).toHaveText("present");
    await expect(page.getByTestId("refresh-token")).toHaveText("present");
    await expect(page.getByTestId("id-token")).toHaveText("present");

    expect(traffic.requests()).toEqual(LOGIN_REQUESTS);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
  });

  test("user.claims has required OIDC fields", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);
    await expect(page.getByTestId("user-sub")).not.toBeEmpty();
    await expect(page.getByTestId("user-iss")).toHaveText("http://localhost:9999/oauth2");
    await expect(page.getByTestId("user-aud")).not.toBeEmpty();
    await expect(page.getByTestId("user-exp")).not.toBeEmpty();
    await expect(page.getByTestId("user-iat")).not.toBeEmpty();

    expect(traffic.requests()).toEqual(LOGIN_REQUESTS);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
  });

  test("user.profile is populated when fetchProfile is true", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);
    await expect(page.getByTestId("user-email")).toHaveText("testuser@test.com");
    await expect(page.getByTestId("user-profile-null")).toHaveText("false");

    expect(traffic.requests()).toEqual(LOGIN_REQUESTS);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
  });

  test("user.profile is null when fetchProfile is false", async ({ page }) => {
    const traffic = trackTraffic(page);
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("e2e-fetchProfile", "false"));
    await page.reload();
    await page.getByTestId("login-button").click();
    await page.waitForURL(/localhost:9999/);
    await page.fill('input[name="username"]', TEST_USER);
    await page.fill('input[name="password"]', TEST_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/localhost:5173/);
    await expect(page.getByTestId("authenticated")).toBeVisible();
    await expect(page.getByTestId("user-profile-null")).toHaveText("true");
    await expect(page.getByTestId("user-email")).toHaveText("no profile");
    await page.evaluate(() => localStorage.removeItem("e2e-fetchProfile"));

    expect(traffic.requests()).toEqual([
      DISCOVERY,
      DISCOVERY,
      DISCOVERY,
      "POST /oauth2/token",
    ]);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
  });

  test("logout clears state", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);
    await page.getByTestId("logout-button").click();
    await page.waitForURL(/localhost/);
    await page.goto("/");
    await expect(page.getByTestId("unauthenticated")).toBeVisible();

    expect(traffic.requests()).toEqual([
      ...LOGIN_REQUESTS,
      DISCOVERY,
      DISCOVERY,
    ]);
    expect(traffic.navigations()).toEqual([
      ...LOGIN_NAVIGATIONS,
      "/oauth2/logout",
    ]);
  });

  test("manual token refresh", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);
    const oldExpiresAt = await page.getByTestId("expires-at").textContent();
    await page.waitForTimeout(1000);
    await page.getByTestId("refresh-button").click();
    await expect(page.getByTestId("authenticated")).toBeVisible();
    await expect(page.getByTestId("expires-at")).not.toHaveText(oldExpiresAt!);

    expect(traffic.requests()).toEqual([
      ...LOGIN_REQUESTS,
      "POST /oauth2/token",
      "GET /oauth2/userinfo",
    ]);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
  });
});

test.describe("Security", () => {
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
    await page.waitForURL(/localhost/);

    await page.goBack();

    await expect(page.getByTestId("authenticated")).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe("Error Handling", () => {
  test("shows error when IdP returns error in callback", async ({ page }) => {
    const traffic = trackTraffic(page);
    await page.goto("/?error=access_denied&error_description=User+denied+consent");
    await expect(page.getByTestId("auth-error")).toBeVisible();
    await expect(page.getByTestId("auth-error")).toContainText("User denied consent");

    expect(traffic.requests()).toEqual([
      DISCOVERY,
    ]);
    expect(traffic.navigations()).toEqual([]);
  });

  test("shows error when callback state does not match (CSRF protection)", async ({ page }) => {
    const traffic = trackTraffic(page);
    await page.goto("/");

    // Plant a fake PKCE auth state with a known state value
    await page.evaluate(() => {
      sessionStorage.setItem("oidc-js:auth-state", JSON.stringify({
        codeVerifier: "fake-verifier",
        state: "correct-state",
        nonce: "fake-nonce",
        redirectUri: "http://localhost:5173/callback",
      }));
    });

    // Navigate with a tampered state — should trigger state mismatch error
    await page.goto("/?code=fake-code&state=tampered-state");
    await expect(page.getByTestId("auth-error")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("auth-error")).toContainText("State");

    expect(traffic.requests()).toEqual([
      DISCOVERY,
      DISCOVERY,
    ]);
    expect(traffic.navigations()).toEqual([]);
  });
});

test.describe("Deep Linking", () => {
  test("login from protected page returns to that page", async ({ page }) => {
    const traffic = trackTraffic(page);
    await page.goto("/protected-a", { waitUntil: "networkidle" });

    await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 15_000 });
    await page.fill('input[name="username"]', TEST_USER);
    await page.fill('input[name="password"]', TEST_PASS);
    await page.click('button[type="submit"]');

    // After login, should land back on /protected-a (not /)
    await expect(page.getByTestId("protected-a")).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain("/protected-a");

    expect(traffic.requests()).toEqual(LOGIN_REQUESTS);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
  });
});

test.describe("RequireAuth", () => {
  test("shows protected content when authenticated", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);
    await page.getByTestId("link-protected-a").click();
    await expect(page.getByTestId("protected-a")).toBeVisible();

    expect(traffic.requests()).toEqual(LOGIN_REQUESTS);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
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

    // Navigate home and verify still authenticated
    await page.getByTestId("link-home").click();
    await expect(page.getByTestId("authenticated")).toBeVisible();

    // No extra requests beyond the initial login flow
    expect(traffic.requests()).toEqual(LOGIN_REQUESTS);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
  });

  test("auto-refreshes expired token when navigating to protected page", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);
    const expiresAt = Number(await page.getByTestId("expires-at").textContent());

    await page.getByTestId("link-protected-a").click();
    await expect(page.getByTestId("protected-a")).toBeVisible();

    // Advance clock 1ms past token expiry so RequireAuth detects it as expired.
    // Save the real Date.now so we can restore it after the refresh fires.
    await page.evaluate((exp) => {
      (window as any).__realDateNow = Date.now;
      Date.now = () => exp + 1;
    }, expiresAt);

    // Restore real clock once the refresh request fires, so the re-render
    // after refresh uses real time and sees the new token as valid.
    page.on("request", (req) => {
      if (req.url().includes("/oauth2/token") && req.resourceType() === "fetch") {
        page.evaluate(() => { Date.now = (window as any).__realDateNow; });
      }
    });

    // Navigate to second protected page — RequireAuth should auto-refresh
    await page.getByTestId("link-protected-b").click();
    await expect(page.getByTestId("protected-b")).toBeVisible({ timeout: 10_000 });

    expect(traffic.requests()).toEqual([
      ...LOGIN_REQUESTS,
      "POST /oauth2/token",
      "GET /oauth2/userinfo",
    ]);
    expect(traffic.navigations()).toEqual(LOGIN_NAVIGATIONS);
  });

  test("redirects to login when refresh token is revoked", async ({ page }) => {
    const traffic = trackTraffic(page);
    await login(page);

    const refreshToken = await page.getByTestId("refresh-token-value").textContent();
    const expiresAt = Number(await page.getByTestId("expires-at").textContent());

    await page.getByTestId("link-protected-a").click();
    await expect(page.getByTestId("protected-a")).toBeVisible();

    await revokeToken(refreshToken!, "refresh_token");

    // Advance clock 1ms past token expiry
    await page.evaluate((exp) => { Date.now = () => exp + 1; }, expiresAt);

    // Navigate to second protected page — refresh should fail, triggering login redirect
    await page.getByTestId("link-protected-b").click();
    await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 15_000 });

    // Failed refresh POST + redirect to authorize
    expect(traffic.requests()).toEqual([
      ...LOGIN_REQUESTS,
      "POST /oauth2/token",
    ]);
    expect(traffic.navigations()).toEqual([
      ...LOGIN_NAVIGATIONS,
      "/oauth2/authorize",
    ]);
  });
});
