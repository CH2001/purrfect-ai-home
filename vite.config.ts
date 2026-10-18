// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Vite exposes VITE_* to browsers; these separate names are for the local Node server only.
const localEnv = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
for (const key of ["APP_MODE", "GOOGLE_CLOUD_PROJECT", "AI_PROVIDER", "GCP_LOCATION", "GEMINI_MODEL_ID", "AI_DAILY_LIMIT", "DEMO_GUEST_ACCESS"]) {
  if (!process.env[key] && localEnv[key]) process.env[key] = localEnv[key];
}

export default defineConfig({
  vite: { server: { watch: { ignored: ["**/.output/**", "**/.nitro/**", "**/infra/.terraform/**"] } } },
  nitro: { preset: "node-server" },
  serverFnErrorLogger: false,
  ssrErrorLogger: false,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
