import { execSync } from "child_process";
import { existsSync, mkdirSync, chmodSync } from "fs";
import { AUTENTICO_BIN, AUTENTICO_DIR, AUTENTICO_RELEASE } from "./autentico.js";

export default async function globalSetup() {
  mkdirSync(AUTENTICO_DIR, { recursive: true });

  if (!existsSync(AUTENTICO_BIN)) {
    console.log("Downloading autentico...");
    execSync(`curl -fsSL -o ${AUTENTICO_BIN} ${AUTENTICO_RELEASE}`, { stdio: "inherit" });
    chmodSync(AUTENTICO_BIN, 0o755);
  }
}
