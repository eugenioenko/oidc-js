import { readFileSync, existsSync, rmSync, copyFileSync } from "fs";
import { join } from "path";

const AUTENTICO_DIR = join(import.meta.dirname, ".autentico");

export default async function globalTeardown() {
  const pidFile = join(AUTENTICO_DIR, "pid");
  if (existsSync(pidFile)) {
    const pid = parseInt(readFileSync(pidFile, "utf-8").trim());
    try {
      process.kill(pid, "SIGTERM");
      console.log(`Stopped autentico (PID ${pid})`);
    } catch {
      // Already dead
    }
  }

  // Preserve the log for CI's "Dump Autentico logs" step before deleting the directory
  const logSrc = join(AUTENTICO_DIR, "autentico.log");
  const logDst = join(import.meta.dirname, "autentico.log");
  if (existsSync(logSrc)) {
    copyFileSync(logSrc, logDst);
  }

  if (existsSync(AUTENTICO_DIR)) {
    rmSync(AUTENTICO_DIR, { recursive: true });
  }
}
