import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [solid(), dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format === "es" ? "js" : "cjs"}`,
    },
    sourcemap: true,
    rollupOptions: {
      external: ["solid-js", "solid-js/web", "solid-js/store", "oidc-js", "oidc-js-core"],
    },
  },
  test: {
    environment: "jsdom",
  },
});
