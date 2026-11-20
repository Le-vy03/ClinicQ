import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  // GitHub Pages serves the project site under /ClinicQ/. Dev stays at /.
  base: mode === "production" ? "/ClinicQ/" : "/",
  plugins: [react()],
  server: { host: "0.0.0.0", port: 4179, strictPort: true },
  preview: { host: "0.0.0.0", port: 4179, strictPort: true },
}));
