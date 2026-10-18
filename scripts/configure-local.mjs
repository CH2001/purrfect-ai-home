import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env")) throw new Error(".env already exists. Edit it manually; this script will not overwrite local settings or secrets.");
const read = name => JSON.parse(execFileSync("terraform", ["-chdir=infra", "output", "-json", name], { encoding: "utf8" }));
const values = { ...read("browser_config"), ...read("server_config") };
writeFileSync(".env", "# Generated local configuration. Never commit this file.\n" + Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n") + "\n", { mode: 0o600 });
console.log("Created .env with public Firebase IDs and server configuration. Authentication uses ADC; no service-account key was written.");
