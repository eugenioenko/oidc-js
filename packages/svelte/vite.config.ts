import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    svelte(),
    dts({ rollupTypes: true }),
  ],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.js",
    },
    sourcemap: true,
    rollupOptions: {
      external: ["svelte", "svelte/internal", "svelte/store", "oidc-js", "oidc-js-core"],
    },
  },
});
