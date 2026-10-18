import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  // Admin SDK dependencies use CommonJS and runtime assets (including protobufs).
  // Keep their package structure in the deployment instead of bundling into ESM.
  traceDeps: ["firebase-admin*", "@google-cloud/firestore*", "google-auth-library*"],
  traceOpts: {
    hooks: {
      tracedPackages(packages) {
        // Nested copies of the same package/version resolve to the same output path.
        // Avoid concurrent writes to that path (EBUSY on Windows).
        for (const pkg of Object.values(packages)) {
          for (const version of Object.values(pkg.versions)) {
            const seen = new Set<string>();
            version.files = version.files.filter(file => {
              const destination = file.replaceAll("\\", "/").split("/node_modules/").at(-1)!;
              if (seen.has(destination)) return false;
              seen.add(destination);
              return true;
            });
          }
        }
      },
    },
  },
});
