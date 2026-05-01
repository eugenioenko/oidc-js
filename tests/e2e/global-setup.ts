import { execSync, spawn } from "child_process";
import { createWriteStream, existsSync, writeFileSync, mkdirSync, rmSync, chmodSync } from "fs";
import { join } from "path";

const AUTENTICO_DIR = join(import.meta.dirname, ".autentico");
const AUTENTICO_BIN = join(AUTENTICO_DIR, "autentico");
const AUTENTICO_RELEASE = "https://github.com/eugenioenko/autentico/releases/download/v2.0.0-beta.1/autentico-linux-amd64";
const AUTENTICO_URL = "http://localhost:9999";
const ADMIN_USER = "admin";
const ADMIN_PASS = "TestAdmin123!";
const ADMIN_EMAIL = "admin@test.com";
const TEST_USER = "testuser";
const TEST_PASS = "TestUser123!";
const TEST_EMAIL = "testuser@test.com";

async function waitForHealthy(url: string, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* server not ready */ }
    await new Promise((r) => setTimeout(r, 500));
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

async function registerTestClient(token: string) {
  const res = await fetch(`${AUTENTICO_URL}/admin/api/clients`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: "e2e-test-app",
      client_name: "E2E Test App",
      redirect_uris: ["http://localhost:5173/callback"],
      post_logout_redirect_uris: ["http://localhost:5173"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scopes: "openid profile email offline_access",
      client_type: "public",
      token_endpoint_auth_method: "none",
    }),
  });
  if (!res.ok) throw new Error(`Failed to register client: ${res.status} ${await res.text()}`);
}

async function createTestUser(token: string) {
  const res = await fetch(`${AUTENTICO_URL}/admin/api/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: TEST_USER,
      password: TEST_PASS,
      email: TEST_EMAIL,
    }),
  });
  if (!res.ok) throw new Error(`Failed to create test user: ${res.status} ${await res.text()}`);
}

async function configureCors(token: string) {
  const res = await fetch(`${AUTENTICO_URL}/admin/api/settings`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cors_allowed_origins: "*",
      sso_enabled: "false",
    }),
  });
  if (!res.ok) throw new Error(`Failed to configure CORS: ${res.status} ${await res.text()}`);
}

export default async function globalSetup() {
  // Clean previous state
  if (existsSync(AUTENTICO_DIR)) {
    rmSync(AUTENTICO_DIR, { recursive: true });
  }
  mkdirSync(AUTENTICO_DIR, { recursive: true });

  // Download autentico binary from release
  if (!existsSync(AUTENTICO_BIN)) {
    console.log("Downloading autentico...");
    execSync(`curl -fsSL -o ${AUTENTICO_BIN} ${AUTENTICO_RELEASE}`, { stdio: "inherit" });
    chmodSync(AUTENTICO_BIN, 0o755);
  }

  // Init and onboard
  console.log("Initializing autentico...");
  execSync(`${AUTENTICO_BIN} init --url ${AUTENTICO_URL}`, { cwd: AUTENTICO_DIR, stdio: "inherit" });
  execSync(
    `${AUTENTICO_BIN} onboard --username ${ADMIN_USER} --password "${ADMIN_PASS}" --email ${ADMIN_EMAIL} --enable-admin-password-grant`,
    { cwd: AUTENTICO_DIR, stdio: "inherit" },
  );

  // Start autentico
  console.log("Starting autentico...");
  const logFile = createWriteStream(join(AUTENTICO_DIR, "autentico.log"));
  const proc = spawn(AUTENTICO_BIN, ["start"], {
    cwd: AUTENTICO_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: {
      ...process.env,
      AUTENTICO_RATE_LIMIT_RPS: "0",
      AUTENTICO_RATE_LIMIT_RPM: "0",
      AUTENTICO_ANTI_TIMING_MIN_MS: "0",
      AUTENTICO_ANTI_TIMING_MAX_MS: "0",
    },
  });
  proc.stdout?.pipe(logFile);
  proc.stderr?.pipe(logFile);
  proc.unref();

  // Save PID for teardown
  writeFileSync(join(AUTENTICO_DIR, "pid"), String(proc.pid));

  // Wait for healthy
  await waitForHealthy(`${AUTENTICO_URL}/.well-known/openid-configuration`);
  console.log("Autentico is ready");

  // Setup test data
  const token = await getAdminToken();
  await registerTestClient(token);
  console.log("Registered e2e-test-app client");
  await createTestUser(token);
  console.log("Created test user");
  await configureCors(token);
  console.log("Configured CORS");
}
