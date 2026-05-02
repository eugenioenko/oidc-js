import { defineConfig } from "vite";
import kasper from "vite-plugin-kasper";

export default defineConfig({
  plugins: [kasper()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
