import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { migrate, seedPeople, IDS, rpc } from "../../scripts/database";
import { updateDemoFixtures } from "../../scripts/demo-fixtures";
it("upgrades the fictional roster once without overwriting saved sessions", async () => {
  const db = new PGlite();
  try {
    await migrate(db);
    await seedPeople(db);
    await rpc(db, IDS.maya, "create_attendance", {
      assignment_id: IDS.assignment,
      occurred_on: "2026-08-01",
      kind: "completed",
      duration_minutes: 37,
      request_id: crypto.randomUUID(),
    });
    await updateDemoFixtures(db);
    await updateDemoFixtures(db);
    const roster = await db.query<{ tutor_id: string }>(
      "select tutor_id from public.assignments",
    );
    expect(roster.rows).toHaveLength(3);
    expect(roster.rows.every((r) => r.tutor_id === IDS.maya)).toBe(true);
    const saved = await db.query<{ duration_minutes: number }>(
      "select duration_minutes from public.attendance_events where assignment_id=$1",
      [IDS.assignment],
    );
    expect(saved.rows).toEqual([{ duration_minutes: 37 }]);
    const empty = await db.query(
      "select id from public.attendance_events where assignment_id='40000000-0000-4000-8000-000000000003'",
    );
    expect(empty.rows).toHaveLength(0);
  } finally {
    await db.close();
  }
});
