import { existsSync, copyFileSync } from "fs";
import { join } from "path";

const IDP_PORT = process.env.E2E_IDP_PORT ?? "9999";
const AUTENTICO_DIR = join(import.meta.dirname, ".autentico");

export default async function globalTeardown() {
  const logSrc = join(AUTENTICO_DIR, `autentico-${IDP_PORT}.log`);
  const logDst = join(import.meta.dirname, `autentico-${IDP_PORT}.log`);
  if (existsSync(logSrc)) {
    copyFileSync(logSrc, logDst);
  }
}
