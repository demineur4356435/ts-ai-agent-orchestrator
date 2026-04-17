import { config } from "dotenv";
import { resolve } from "node:path";

/** Load `.env.local` then `.env` from the current working directory (quiet). */
export function loadEnv(): void {
  config({ path: resolve(process.cwd(), ".env.local"), quiet: true });
  config({ path: resolve(process.cwd(), ".env"), quiet: true });
}
