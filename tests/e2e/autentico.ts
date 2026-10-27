import { join } from "path";

export const AUTENTICO_VERSION = "3.0.0-beta.1";
export const AUTENTICO_DIR = join(import.meta.dirname, ".autentico");
export const AUTENTICO_BIN = join(AUTENTICO_DIR, `autentico-${AUTENTICO_VERSION}`);
export const AUTENTICO_RELEASE = `https://github.com/eugenioenko/autentico/releases/download/v${AUTENTICO_VERSION}/autentico-linux-amd64`;
