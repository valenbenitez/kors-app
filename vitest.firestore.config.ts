import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** Vitest config for Firestore emulator integration tests only. */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/lib/firebase/trip-quotes/repository.emulator.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
