import { test as base } from "@playwright/test";
import { execSync, spawn } from "child_process";
import { randomBytes, generateKeyPairSync } from "crypto";
import { createWriteStream, existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const IDP_PORT = process.env.E2E_IDP_PORT ?? "9999";
const APP_PORT = process.env.E2E_APP_PORT ?? "5173";
const AUTENTICO_DIR = join(import.meta.dirname, "..", ".autentico");
const AUTENTICO_BIN = join(AUTENTICO_DIR, "autentico");
const DB_DIR = join(AUTENTICO_DIR, "db");
const LOG_DIR = join(AUTENTICO_DIR, "logs");
const AUTENTICO_URL = `http://localhost:${IDP_PORT}`;
const DB_FILE = join(DB_DIR, `autentico-${IDP_PORT}.db`);
const ADMIN_USER = "admin";
const ADMIN_PASS = "TestAdmin123!";
const ADMIN_EMAIL = "admin@test.com";
const TEST_USER = "testuser";
const TEST_PASS = "TestUser123!";
const TEST_EMAIL = "testuser@test.com";

const ACCESS_TOKEN_SECRET = randomBytes(32).toString("hex");
const REFRESH_TOKEN_SECRET = randomBytes(32).toString("hex");
const CSRF_SECRET_KEY = randomBytes(32).toString("hex");
const PRIVATE_KEY = generateKeyPairSync("rsa", { modulusLength: 2048 })
  .privateKey.export({ type: "pkcs1", format: "pem" });
const PRIVATE_KEY_B64 = Buffer.from(PRIVATE_KEY as string).toString("base64");

async function waitForHealthy(url: string, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* server not ready */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Autentico did not become healthy within ${timeoutMs}ms`);
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
  if (!res.ok) throw new Error(`Failed to get admin token: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function seedTestData(token: string) {
  const clientRes = await fetch(`${AUTENTICO_URL}/admin/api/clients`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: "e2e-test-app",
      client_name: "E2E Test App",
      redirect_uris: [`http://localhost:${APP_PORT}/callback`],
      post_logout_redirect_uris: [`http://localhost:${APP_PORT}`],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scopes: "openid profile email offline_access",
      client_type: "public",
      token_endpoint_auth_method: "none",
    }),
  });
  if (!clientRes.ok) throw new Error(`Failed to register client: ${clientRes.status} ${await clientRes.text()}`);

  const userRes = await fetch(`${AUTENTICO_URL}/admin/api/users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ username: TEST_USER, password: TEST_PASS, email: TEST_EMAIL }),
  });
  if (!userRes.ok) throw new Error(`Failed to create test user: ${userRes.status} ${await userRes.text()}`);

  const corsRes = await fetch(`${AUTENTICO_URL}/admin/api/settings`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ cors_allowed_origins: "*", sso_enabled: "false" }),
  });
  if (!corsRes.ok) throw new Error(`Failed to configure CORS: ${corsRes.status} ${await corsRes.text()}`);
}

function cleanDb() {
  mkdirSync(DB_DIR, { recursive: true });
  for (const suffix of ["", "-shm", "-wal"]) {
    const p = `${DB_FILE}${suffix}`;
    if (existsSync(p)) rmSync(p);
  }
}

export const test = base.extend<{ autentico: void }>({
  // eslint-disable-next-line no-empty-pattern
  autentico: [async ({ }, use) => {
    cleanDb();

    const envVars = {
      ...process.env,
      AUTENTICO_ACCESS_TOKEN_SECRET: ACCESS_TOKEN_SECRET,
      AUTENTICO_REFRESH_TOKEN_SECRET: REFRESH_TOKEN_SECRET,
      AUTENTICO_CSRF_SECRET_KEY: CSRF_SECRET_KEY,
      AUTENTICO_PRIVATE_KEY: PRIVATE_KEY_B64,
      AUTENTICO_DB_FILE_PATH: DB_FILE,
      AUTENTICO_APP_URL: AUTENTICO_URL,
      AUTENTICO_LISTEN_PORT: IDP_PORT,
      AUTENTICO_RATE_LIMIT_RPS: "0",
      AUTENTICO_RATE_LIMIT_RPM: "0",
      AUTENTICO_RATE_LIMIT_BURST: "0",
      AUTENTICO_RATE_LIMIT_RPM_BURST: "0",
      AUTENTICO_ANTI_TIMING_MIN_MS: "0",
      AUTENTICO_ANTI_TIMING_MAX_MS: "0",
      AUTENTICO_CSRF_SECURE_COOKIE: "false",
      AUTENTICO_IDP_SESSION_SECURE: "false",
    };

    execSync(
      `${AUTENTICO_BIN} onboard --username ${ADMIN_USER} --password "${ADMIN_PASS}" --email ${ADMIN_EMAIL} --enable-admin-password-grant`,
      { cwd: AUTENTICO_DIR, stdio: "pipe", env: envVars },
    );

    mkdirSync(LOG_DIR, { recursive: true });
    const logFile = createWriteStream(join(LOG_DIR, `autentico-${IDP_PORT}.log`));
    const proc = spawn(AUTENTICO_BIN, ["start"], {
      cwd: AUTENTICO_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      env: envVars,
    });
    proc.stdout?.pipe(logFile);
    proc.stderr?.pipe(logFile);

    await waitForHealthy(`${AUTENTICO_URL}/.well-known/openid-configuration`);

    const token = await getAdminToken();
    await seedTestData(token);

    await use();

    const closed = new Promise<void>((resolve) => proc.on("close", resolve));
    proc.kill("SIGTERM");
    await closed;
    logFile.close();
  }, { auto: true }],
});

export { expect } from "@playwright/test";
