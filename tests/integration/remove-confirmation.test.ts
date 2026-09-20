import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  migrate,
  applyMigrations,
  seedPeople,
  IDS,
  rpc,
  asUser,
} from "../../scripts/database";
it("upgrades an existing database without losing sessions and retires confirmation", async () => {
  const db = new PGlite();
  try {
    await migrate(db, "20260919055430_initial_reporting.sql");
    await seedPeople(db);
    const event = await rpc<{ id: string }>(db, IDS.maya, "create_attendance", {
      assignment_id: IDS.assignment,
      occurred_on: "2026-08-10",
      duration_minutes: 37,
      kind: "completed",
      request_id: crypto.randomUUID(),
    });
    await asUser(db, IDS.maya, "select public.confirm_month($1::jsonb)", [
      JSON.stringify({
        assignment_id: IDS.assignment,
        month_start: "2026-08-01",
        expected_revision: 1,
      }),
    ]);
    await applyMigrations(db, true);
    await applyMigrations(db, true);
    expect(
      (
        await db.query(
          "select id,duration_minutes from public.attendance_events",
        )
      ).rows,
    ).toEqual([{ id: event.id, duration_minutes: 37 }]);
    expect(
      (
        await db.query(
          "select to_regclass('public.attendance_months') as tbl, to_regprocedure('public.confirm_month(jsonb)') as fn",
        )
      ).rows,
    ).toEqual([{ tbl: null, fn: null }]);
    await expect(
      asUser(db, IDS.maya, "select public.confirm_month('{}'::jsonb)"),
    ).rejects.toThrow();
  } finally {
    await db.close();
  }
});
