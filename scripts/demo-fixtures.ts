import type { PGlite } from "@electric-sql/pglite";
import { IDS, rpc } from "./database";

// Local walkthrough only. Keep security-test fixtures independent of this roster.
export async function updateDemoFixtures(db: PGlite) {
  await db.exec(
    "create table if not exists private.local_fixture_updates (version text primary key)",
  );
  const applied = await db.query(
    "select version from private.local_fixture_updates where version='three-students-v1'",
  );
  if (applied.rows.length) return;
  await db.transaction(async (tx) => {
    await tx.exec(`
      insert into public.students(id,display_name) values ('20000000-0000-4000-8000-000000000003','Clara Nguyen') on conflict(id) do nothing;
      update public.assignments set tutor_id='${IDS.maya}',version=version+1 where id='${IDS.otherAssignment}' and tutor_id='${IDS.leo}';
      insert into public.assignments(id,tutor_id,student_id,term_id,starts_on,site,usual_days,usual_times)
      values ('40000000-0000-4000-8000-000000000003','${IDS.maya}','20000000-0000-4000-8000-000000000003','${IDS.term}','2026-07-01','Bloomfield Public Library','Friday','3:00 PM') on conflict(id) do nothing;
    `);
  });
  // Preserve saved sessions, including edits made during the earlier walkthrough.
  for (const [assignment, entries] of [
    [
      IDS.assignment,
      [
        ["2026-08-10", 90],
        ["2026-08-17", 60],
        ["2026-09-10", 90],
        ["2026-09-17", 60],
      ],
    ],
    [
      IDS.otherAssignment,
      [
        ["2026-08-10", 45],
        ["2026-08-15", 75],
        ["2026-09-10", 45],
        ["2026-09-15", 75],
      ],
    ],
  ] as const) {
    const existing = await db.query(
      "select id from public.attendance_events where assignment_id=$1 limit 1",
      [assignment],
    );
    if (!existing.rows.length)
      for (const [date, minutes] of entries) {
        // Fixed program-year examples; never create future sessions.
        const allowed = await db.query<{ allowed: boolean }>(
          "select $1::date <= private.today() as allowed",
          [date],
        );
        if (allowed.rows[0].allowed)
          await rpc(db, IDS.maya, "create_attendance", {
            assignment_id: assignment,
            occurred_on: date,
            duration_minutes: minutes,
            kind: "completed",
            request_id: crypto.randomUUID(),
          });
      }
  }
  await db.exec(
    "insert into private.local_fixture_updates(version) values ('three-students-v1')",
  );
}
