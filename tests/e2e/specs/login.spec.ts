import { test, expect } from "@playwright/test";

const AUTENTICO_URL = "http://localhost:9999";
const TEST_USER = "testuser";
const TEST_PASS = "TestUser123!";
const ADMIN_USER = "admin";
const ADMIN_PASS = "TestAdmin123!";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByTestId("login-button").click();
  await page.waitForURL(/localhost:9999/);
  await page.fill('input[name="username"]', TEST_USER);
  await page.fill('input[name="password"]', TEST_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/localhost:5173/);
  await expect(page.getByTestId("authenticated")).toBeVisible();
}

async function getAdminToken(): Promise<string> {
  const res = await fetch(`${AUTENTICO_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      username: ADMIN_USER,
      password: ADMIN_PASS,
      client_id: "autentico-admin",
      scope: "openid",
    }),
  });
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function setClientTokenExpiration(expiration: string | null) {
  const token = await getAdminToken();
  await fetch(`${AUTENTICO_URL}/admin/api/clients/e2e-test-app`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      access_token_expiration: expiration,
    }),
  });
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

test.describe("OIDC Login Flow", () => {
  test("shows login button when not authenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("unauthenticated")).toBeVisible();
    await expect(page.getByTestId("login-button")).toBeVisible();
  });

  test("completes full login flow with tokens", async ({ page }) => {
    await login(page);
    await expect(page.getByTestId("access-token")).toHaveText("present");
    await expect(page.getByTestId("refresh-token")).toHaveText("present");
    await expect(page.getByTestId("id-token")).toHaveText("present");
  });

  test("user.claims has required OIDC fields", async ({ page }) => {
    await login(page);
    await expect(page.getByTestId("user-sub")).not.toBeEmpty();
    await expect(page.getByTestId("user-iss")).toHaveText("http://localhost:9999/oauth2");
    await expect(page.getByTestId("user-aud")).not.toBeEmpty();
    await expect(page.getByTestId("user-exp")).not.toBeEmpty();
    await expect(page.getByTestId("user-iat")).not.toBeEmpty();
  });

  test("user.profile is populated when fetchProfile is true", async ({ page }) => {
    await login(page);
    await expect(page.getByTestId("user-email")).toHaveText("testuser@test.com");
    await expect(page.getByTestId("user-profile-null")).toHaveText("false");
  });

  test("user.profile is null when fetchProfile is false", async ({ page }) => {
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
  });

  test("logout clears state", async ({ page }) => {
    await login(page);
    await page.getByTestId("logout-button").click();
    await page.waitForURL(/localhost/);
    await page.goto("/");
    await expect(page.getByTestId("unauthenticated")).toBeVisible();
  });

  test("manual token refresh", async ({ page }) => {
    await login(page);
    const oldExpiresAt = await page.getByTestId("expires-at").textContent();
    await page.waitForTimeout(1000);
    await page.getByTestId("refresh-button").click();
    await expect(page.getByTestId("authenticated")).toBeVisible();
    await expect(page.getByTestId("expires-at")).not.toHaveText(oldExpiresAt!);
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

test.describe("Deep Linking", () => {
  test("login from protected page returns to that page", async ({ page }) => {
    await page.goto("/protected-a", { waitUntil: "networkidle" });

    await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 15_000 });
    await page.fill('input[name="username"]', TEST_USER);
    await page.fill('input[name="password"]', TEST_PASS);
    await page.click('button[type="submit"]');

    // After login, should land back on /protected-a (not /)
    await expect(page.getByTestId("protected-a")).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain("/protected-a");
  });
});

test.describe("RequireAuth", () => {
  test("shows protected content when authenticated", async ({ page }) => {
    await login(page);
    await page.getByTestId("link-protected-a").click();
    await expect(page.getByTestId("protected-a")).toBeVisible();
  });

  test("auto-refreshes expired token when navigating to protected page", async ({ page }) => {
    await setClientTokenExpiration("1s");
    try {
      await login(page);
      await page.getByTestId("link-protected-a").click();
      await expect(page.getByTestId("protected-a")).toBeVisible();

      // Wait for token to expire
      await page.waitForTimeout(5000);

      // Navigate to second protected page via client-side link — RequireAuth should auto-refresh
      await page.getByTestId("link-protected-b").click();
      await expect(page.getByTestId("protected-b")).toBeVisible({ timeout: 10_000 });
    } finally {
      await setClientTokenExpiration(null);
    }
  });

  test("redirects to login when refresh token is revoked", async ({ page }) => {
    await setClientTokenExpiration("5s");
    try {
      await login(page);

      // Grab the refresh token from home page before navigating away
      const refreshToken = await page.getByTestId("refresh-token-value").textContent();

      await page.getByTestId("link-protected-a").click();
      await expect(page.getByTestId("protected-a")).toBeVisible();

      // Revoke the refresh token server-side
      await revokeToken(refreshToken!, "refresh_token");

      // Wait for access token to expire
      await page.waitForTimeout(7000);

      // Navigate to second protected page — refresh should fail, triggering login redirect
      await page.getByTestId("link-protected-b").click();
      await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 15_000 });
    } finally {
      await setClientTokenExpiration(null);
    }
  });
});
