import { readFileSync, existsSync, rmSync } from "fs";
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

  if (existsSync(AUTENTICO_DIR)) {
    rmSync(AUTENTICO_DIR, { recursive: true });
  }
}
