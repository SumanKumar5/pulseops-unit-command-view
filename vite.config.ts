import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "pulseops",
      filename: "remoteEntry.js",
      exposes: {
        "./UnitCommandView": "./src/features/UnitCommandView/index.tsx",
      },
      shared: ["react", "react-dom"],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "esnext",
    minify: false,
    cssCodeSplit: false,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/lib/vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/services/sseManager.ts",
        "src/hooks/useUnitViewState.ts",
        "src/workers/patientWorker.ts",
      ],
    },
  },
});
