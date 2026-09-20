import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
export const IDS = {
  maya: "10000000-0000-4000-8000-000000000001",
  leo: "10000000-0000-4000-8000-000000000002",
  sam: "10000000-0000-4000-8000-000000000003",
  pending: "10000000-0000-4000-8000-000000000004",
  ana: "20000000-0000-4000-8000-000000000001",
  ben: "20000000-0000-4000-8000-000000000002",
  term: "30000000-0000-4000-8000-000000000001",
  assignment: "40000000-0000-4000-8000-000000000001",
  otherAssignment: "40000000-0000-4000-8000-000000000002",
};
export async function migrate(db: PGlite, through?: string) {
  await db.exec(`create schema auth; create role anon nologin; create role authenticated nologin; grant usage on schema public,auth to authenticated;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create table auth.identities(user_id uuid references auth.users(id),provider text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant execute on function auth.uid() to authenticated;`);
  await applyMigrations(db, false, through);
  await db.exec(await readFile("supabase/seed.sql", "utf8"));
}
// Local-only ledger; hosted Supabase uses its own migration tracking.
export async function applyMigrations(
  db: PGlite,
  legacy = false,
  through?: string,
) {
  await db.exec("create table if not exists auth.identities(user_id uuid references auth.users(id),provider text)");
  await db.exec(
    "create schema if not exists local_runtime; create table if not exists local_runtime.local_migrations(name text primary key)",
  );
  if (legacy)
    await db.query(
      "insert into local_runtime.local_migrations(name) values ($1) on conflict do nothing",
      ["20260919055430_initial_reporting.sql"],
    );
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (through && file > through) break;
    if (
      (
        await db.query(
          "select name from local_runtime.local_migrations where name=$1",
          [file],
        )
      ).rows.length
    )
      continue;
    const sql = await readFile(join("supabase/migrations", file), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query(
        "insert into local_runtime.local_migrations(name) values($1)",
        [file],
      );
    });
  }
}
export async function seedPeople(db: PGlite) {
  await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values
 ('${IDS.maya}','maya@example.test','{"full_name":"Maya Patel"}'),('${IDS.leo}','leo@example.test','{"full_name":"Leo Chen"}'),('${IDS.sam}','sam@example.test','{"full_name":"Sam Rivera"}'),('${IDS.pending}','pending@example.test','{"full_name":"Jordan Lee"}');
 update public.memberships set status='active' where user_id<>'${IDS.pending}'; update public.memberships set role='staff' where user_id='${IDS.sam}';
 insert into public.assignments(id,tutor_id,student_id,term_id,starts_on,site,usual_days,usual_times) values
 ('${IDS.assignment}','${IDS.maya}','${IDS.ana}','${IDS.term}','2026-07-01','Bloomfield Public Library','Tuesday & Thursday','4:00 PM'),
 ('${IDS.otherAssignment}','${IDS.leo}','${IDS.ben}','${IDS.term}','2026-07-01','Bloomfield Public Library','Wednesday','5:30 PM');`);
}
export async function asUser<T>(
  db: PGlite,
  uid: string,
  sql: string,
  params: unknown[] = [],
) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
    await tx.exec("set local role authenticated");
    return tx.query<T>(sql, params);
  });
}
export async function rpc<T = unknown>(
  db: PGlite,
  uid: string,
  name: string,
  p?: unknown,
): Promise<T> {
  if (
    ![
      "workspace",
      "demo_context",
      "attendance_report",
      "achievement_report",
      "create_attendance",
      "edit_attendance",
      "save_student",
      "save_assignment",
      "set_membership",
      "save_achievement",
    ].includes(name)
  )
    throw new Error("Unknown operation");
  const r = await asUser<{ result: T }>(
    db,
    uid,
    `select public.${name}(${p === undefined ? "" : "$1::jsonb"}) as result`,
    p === undefined ? [] : [JSON.stringify(p)],
  );
  return r.rows[0].result;
}
