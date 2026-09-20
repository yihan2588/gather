import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { migrate, seedPeople, rpc, asUser, IDS } from "../../scripts/database";
let db: PGlite;
type Event = { id: string; version: number; duration_minutes: number };
type Report = {
  summary: {
    total_minutes: number;
    completed_sessions: number;
  }[];
  detail: unknown[];
};
const entry = (minutes = 90) => ({
  assignment_id: IDS.assignment,
  occurred_on: "2026-08-10",
  kind: "completed",
  duration_minutes: minutes,
  request_id: randomUUID(),
});
beforeAll(async () => {
  db = new PGlite();
  await migrate(db);
  await seedPeople(db);
  await db.exec(
    "create or replace function private.today() returns date language sql stable as $$ select date '2026-10-05' $$",
  );
});
afterAll(async () => {
  await db.close();
});
describe("PostgreSQL contracts (real SQL and RLS, isolated Auth identity shim)", () => {
  it("denies pending, cross-tutor, and direct-table writes", async () => {
    expect(
      (await asUser(db, IDS.pending, "select * from public.students")).rows,
    ).toHaveLength(0);
    expect(
      (await asUser(db, IDS.maya, "select * from public.assignments")).rows,
    ).toHaveLength(1);
    await expect(
      rpc(db, IDS.leo, "create_attendance", entry()),
    ).rejects.toThrow();
    await expect(
      asUser(
        db,
        IDS.maya,
        "update public.memberships set role='staff' where user_id=$1",
        [IDS.maya],
      ),
    ).rejects.toThrow();
    await expect(
      asUser(
        db,
        IDS.maya,
        "update public.assignments set site='Unauthorized' where id=$1",
        [IDS.assignment],
      ),
    ).rejects.toThrow();
  });
  it("preserves retries, totals, optimistic edits, and void history", async () => {
    const p = entry();
    const e = await rpc<Event>(db, IDS.maya, "create_attendance", p);
    expect((await rpc<Event>(db, IDS.maya, "create_attendance", p)).id).toBe(
      e.id,
    );
    await expect(
      rpc(db, IDS.maya, "create_attendance", { ...p, duration_minutes: 91 }),
    ).rejects.toThrow();
    const second = await rpc<Event>(
      db,
      IDS.maya,
      "create_attendance",
      entry(60),
    );
    const filter = {
      term_id: IDS.term,
      month: "2026-08-01",
      tutor_id: IDS.maya,
    };
    let r = await rpc<Report>(db, IDS.sam, "attendance_report", filter);
    expect(r.summary[0].total_minutes).toBe(150);
    expect(r.summary[0].completed_sessions).toBe(2);
    await rpc(db, IDS.maya, "edit_attendance", {
      id: second.id,
      expected_version: 1,
      occurred_on: "2026-08-10",
      kind: "completed",
      duration_minutes: 45,
    });
    r = await rpc<Report>(db, IDS.sam, "attendance_report", filter);
    expect(r.summary[0].total_minutes).toBe(135);
    await expect(
      rpc(db, IDS.maya, "edit_attendance", {
        id: second.id,
        expected_version: 1,
        occurred_on: "2026-08-10",
        kind: "completed",
        duration_minutes: 40,
      }),
    ).rejects.toThrow();
    await rpc(db, IDS.maya, "edit_attendance", {
      id: second.id,
      expected_version: 2,
      void_reason: "Entered by mistake",
    });
    r = await rpc<Report>(db, IDS.sam, "attendance_report", filter);
    expect(r.summary[0].total_minutes).toBe(90);
    expect(r.detail).toHaveLength(1);
  });
  it("rejects invalid inputs and enforces internal absence codes", async () => {
    for (const x of [
      { duration_minutes: -2 },
      { duration_minutes: 1.5 },
      { occurred_on: "2027-01-01" },
      { occurred_on: "2026-06-30" },
      { kind: "student_absent", duration_minutes: 0 },
    ])
      await expect(
        rpc(db, IDS.maya, "create_attendance", { ...entry(), ...x }),
      ).rejects.toThrow();
    await rpc(db, IDS.sam, "create_attendance", {
      ...entry(0),
      kind: "student_absent",
    });
    await expect(
      rpc(db, IDS.maya, "attendance_report", {
        term_id: IDS.term,
        month: "2026-08-01",
      }),
    ).rejects.toThrow();
  });
  it("includes zero-entry assignments without completeness fields", async () => {
    const r = await rpc<Report>(db, IDS.sam, "attendance_report", {
      term_id: IDS.term,
      month: "2026-07-01",
    });
    expect(r.summary).toHaveLength(2);
    expect(r.summary[0].total_minutes).toBe(0);
    expect(r.summary[0]).not.toHaveProperty("confirmation_status");
    expect(
      (
        await db.query(
          "select to_regprocedure('public.confirm_month(jsonb)') as fn",
        )
      ).rows[0],
    ).toEqual({ fn: null });
  });
  it("protects assignment intervals and achievement ownership", async () => {
    await expect(
      rpc(db, IDS.maya, "save_assignment", {
        id: IDS.assignment,
        expected_version: 1,
        starts_on: "2026-07-01",
        ends_on: "2026-07-31",
        end_reason: "Stopped",
      }),
    ).rejects.toThrow();
    await rpc(db, IDS.maya, "save_achievement", {
      student_id: IDS.ana,
      term_id: IDS.term,
      goal_type_id: "C5",
      attained_on: "2026-08-15",
    });
    await expect(
      rpc(db, IDS.leo, "save_achievement", {
        student_id: IDS.ana,
        term_id: IDS.term,
        goal_type_id: "C4",
        attained_on: "2026-08-15",
      }),
    ).rejects.toThrow();
    expect(
      await rpc<unknown[]>(db, IDS.sam, "achievement_report", {
        term_id: IDS.term,
        month: "2026-08-01",
      }),
    ).toHaveLength(1);
  });
  it("revokes access even with an existing identity", async () => {
    await rpc(db, IDS.sam, "set_membership", {
      user_id: IDS.leo,
      status: "disabled",
    });
    expect(
      (await asUser(db, IDS.leo, "select * from public.students")).rows,
    ).toHaveLength(0);
    await expect(
      rpc(db, IDS.leo, "create_attendance", {
        ...entry(),
        assignment_id: IDS.otherAssignment,
      }),
    ).rejects.toThrow();
  });
});

describe("report boundaries and scale", () => {
  it("updates both monthly totals when moving an entry", async () => {
    const e = await rpc<Event>(db, IDS.maya, "create_attendance", {
      ...entry(30),
      occurred_on: "2026-09-30",
    });
    await rpc(db, IDS.maya, "edit_attendance", {
      id: e.id,
      expected_version: 1,
      occurred_on: "2026-10-01",
      kind: "completed",
      duration_minutes: 30,
    });
    const sep = await rpc<Report>(db, IDS.sam, "attendance_report", {
      term_id: IDS.term,
      month: "2026-09-01",
      tutor_id: IDS.maya,
    });
    const oct = await rpc<Report>(db, IDS.sam, "attendance_report", {
      term_id: IDS.term,
      month: "2026-10-01",
      tutor_id: IDS.maya,
    });
    expect(sep.summary[0].total_minutes).toBe(0);
    expect(oct.summary[0].total_minutes).toBe(30);
  });
  it("exports all 1,101 records without a PostgREST row-limit dependency", async () => {
    await db.exec(
      `insert into public.attendance_events(assignment_id,occurred_on,kind,duration_minutes,request_id,creation_payload,created_by,updated_by) select '${IDS.assignment}','2026-07-15','completed',1,gen_random_uuid(),'{}','${IDS.maya}','${IDS.maya}' from generate_series(1,1101);`,
    );
    const report = await rpc<Report>(db, IDS.sam, "attendance_report", {
      term_id: IDS.term,
      month: "2026-07-01",
      tutor_id: IDS.maya,
    });
    expect(report.detail).toHaveLength(1101);
    expect(report.summary[0].total_minutes).toBe(1101);
  });
  it("prevents overlapping assignments and duplicate goal attainment", async () => {
    await expect(
      rpc(db, IDS.sam, "save_assignment", {
        tutor_id: IDS.maya,
        student_id: IDS.ana,
        term_id: IDS.term,
        starts_on: "2026-07-15",
      }),
    ).rejects.toThrow();
    await expect(
      rpc(db, IDS.maya, "save_achievement", {
        student_id: IDS.ana,
        term_id: IDS.term,
        goal_type_id: "C5",
        attained_on: "2026-08-15",
      }),
    ).rejects.toThrow();
  });
});
