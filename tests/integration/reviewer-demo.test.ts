import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { migrate, asUser, IDS } from "../../scripts/database";

it("grants Google reviewers shared personas without exposing or changing reviewer accounts", async () => {
  const db = new PGlite();
  const reviewer = crypto.randomUUID();
  const other = crypto.randomUUID();
  try {
    await migrate(db);
    await db.query(
      "insert into auth.users(id,email) values ($1,'reviewer@example.test'),($2,'other@example.test')",
      [reviewer, other],
    );
    await db.query(
      "insert into auth.identities(user_id,provider) values ($1,'google')",
      [reviewer],
    );
    const query = async (uid: string, persona: string, sql: string) =>
      db.transaction(async (tx) => {
        await tx.query(
          "select set_config('request.jwt.claim.sub',$1,true),set_config('request.headers',$2,true)",
          [uid, JSON.stringify({ "x-gather-persona": persona })],
        );
        await tx.exec("set local role authenticated");
        return tx.query(sql);
      });
    expect(
      (await query(reviewer, "staff", "select private.actor_id() as id")).rows,
    ).toEqual([{ id: reviewer }]);
    await db.exec(await readFile("supabase/demo.sql", "utf8"));
    expect(
      (await query(reviewer, "staff", "select private.actor_id() as id")).rows,
    ).toEqual([{ id: IDS.sam }]);
    expect(
      (await query(other, "staff", "select private.actor_id() as id")).rows,
    ).toEqual([{ id: other }]);
    const roster = await query(
      reviewer,
      "staff",
      "select user_id from public.memberships",
    );
    expect(roster.rows).toHaveLength(4);
    expect(roster.rows).not.toContainEqual({ user_id: reviewer });
    expect(
      (await query(reviewer, "tutor", "select id from public.assignments"))
        .rows,
    ).toHaveLength(3);
    expect(
      (await query(reviewer, "leo", "select id from public.assignments")).rows,
    ).toHaveLength(0);
    expect(
      (await query(reviewer, "pending", "select id from public.students")).rows,
    ).toHaveLength(0);
    await expect(
      query(reviewer, "admin", "select private.actor_id()"),
    ).rejects.toThrow("Unknown demo account");
    await expect(
      query(
        reviewer,
        "staff",
        `select public.set_membership('{"user_id":"${other}","status":"active"}')`,
      ),
    ).rejects.toThrow("Only example accounts");
    await expect(
      query(
        reviewer,
        "staff",
        "update private.demo_settings set enabled=false",
      ),
    ).rejects.toThrow();
    await expect(
      query(
        reviewer,
        "tutor",
        `select public.save_student('{"display_name":"Forbidden"}')`,
      ),
    ).rejects.toThrow("Staff access required");
    await query(
      reviewer,
      "staff",
      `select public.save_student('{"display_name":"Demo student"}')`,
    );
    await query(
      reviewer,
      "tutor",
      `select public.create_attendance('{"assignment_id":"${IDS.assignment}","occurred_on":"2026-08-10","kind":"completed","duration_minutes":37,"request_id":"${crypto.randomUUID()}"}')`,
    );
    const report = await query(
      reviewer,
      "staff",
      `select public.attendance_report('{"term_id":"${IDS.term}","month":"2026-08-01"}') as report`,
    );
    expect(JSON.stringify(report.rows)).toContain("37");
    await expect(
      asUser(db, other, "select * from public.students"),
    ).resolves.toMatchObject({ rows: [] });
    await db.exec("update private.demo_settings set enabled=false");
    expect(
      (await query(reviewer, "staff", "select private.actor_id() as id")).rows,
    ).toEqual([{ id: reviewer }]);
    expect(
      (await query(reviewer, "staff", "select id from public.students")).rows,
    ).toHaveLength(0);
  } finally {
    await db.close();
  }
});
