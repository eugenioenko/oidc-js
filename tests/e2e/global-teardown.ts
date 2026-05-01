import { existsSync, copyFileSync } from "fs";
import { join } from "path";

const AUTENTICO_DIR = join(import.meta.dirname, ".autentico");

export default async function globalTeardown() {
  const logSrc = join(AUTENTICO_DIR, "autentico.log");
  const logDst = join(import.meta.dirname, "autentico.log");
  if (existsSync(logSrc)) {
    copyFileSync(logSrc, logDst);
  }
}
