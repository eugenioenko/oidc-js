import { execSync } from "child_process";
import { existsSync, mkdirSync, chmodSync } from "fs";
import { join } from "path";

const AUTENTICO_DIR = join(import.meta.dirname, ".autentico");
const AUTENTICO_BIN = join(AUTENTICO_DIR, "autentico");
const AUTENTICO_RELEASE = "https://github.com/eugenioenko/autentico/releases/download/v2.0.0-beta.1/autentico-linux-amd64";
const AUTENTICO_URL = "http://localhost:9999";

export default async function globalSetup() {
  mkdirSync(AUTENTICO_DIR, { recursive: true });

  if (!existsSync(AUTENTICO_BIN)) {
    console.log("Downloading autentico...");
    execSync(`curl -fsSL -o ${AUTENTICO_BIN} ${AUTENTICO_RELEASE}`, { stdio: "inherit" });
    chmodSync(AUTENTICO_BIN, 0o755);
  }

  const envFile = join(AUTENTICO_DIR, ".env");
  if (!existsSync(envFile)) {
    console.log("Initializing autentico...");
    execSync(`${AUTENTICO_BIN} init --url ${AUTENTICO_URL}`, { cwd: AUTENTICO_DIR, stdio: "inherit" });
  }
}
