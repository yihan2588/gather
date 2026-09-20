import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { mkdir } from "node:fs/promises";
import {
  migrate,
  applyMigrations,
  seedPeople,
  rpc,
  IDS,
} from "../../scripts/database";
import { updateDemoFixtures } from "../../scripts/demo-fixtures";
export { IDS };
export function localDemo() {
  return (
    process.env.LOCAL_DEMO === "1" &&
    !process.env.VERCEL &&
    process.env.NODE_ENV !== "production"
  );
}
const globalDb = globalThis as unknown as { lvaepDb?: Promise<PGlite> };
export async function demoDb() {
  if (!localDemo()) throw new Error("Local demonstration disabled");
  if (!globalDb.lvaepDb)
    globalDb.lvaepDb = (async () => {
      const directory = process.env.DEMO_DATA_DIR ?? ".local-demo/postgres";
      await mkdir(directory, { recursive: true });
      const db = new PGlite(directory);
      const exists = await db.query<{ name: string | null }>(
        "select to_regclass('public.memberships')::text as name",
      );
      if (!exists.rows[0].name) {
        await migrate(db);
        await seedPeople(db);
      }
      await applyMigrations(db, true);
      await updateDemoFixtures(db);
      return db;
    })();
  return globalDb.lvaepDb;
}
export async function demoRpc<T>(uid: string, name: string, p?: unknown) {
  return rpc<T>(await demoDb(), uid, name, p);
}
