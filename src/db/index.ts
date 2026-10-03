import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:data/offthechart.db";

if (url.startsWith("file:")) {
  // Make sure the data directory exists for a fresh clone.
  mkdirSync(path.dirname(url.slice("file:".length)), { recursive: true });
}

const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

export const db = drizzle(client, { schema });

let migrated: Promise<void> | null = null;

/**
 * Applies the committed migrations once per process. Called by the data
 * services before their first query so a fresh clone works with no setup.
 */
export function ready(): Promise<void> {
  if (!migrated) {
    migrated = migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") }).catch((err) => {
      migrated = null;
      throw err;
    });
  }
  return migrated;
}

export { schema };
