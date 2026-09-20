# Running and deploying Gather

Gather is the first implementation of the tutor reporting specification. It has a Supabase-backed application path and a separate, explicitly local walkthrough that runs the same SQL migration and operations against embedded PostgreSQL (PGlite).

## Run the local walkthrough

Use the Node version in `.nvmrc` and pnpm version in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev:demo
```

Open http://localhost:3000. Choose Maya (three students), Leo (no students), Sam (staff), or the pending-access example. These are fictional local personas, not Supabase accounts. The demo cookie is only recognized when `LOCAL_DEMO=1`, `NODE_ENV` is not production, and `VERCEL` is unset. It cannot grant access to the Supabase database.

The example roster has Maya assigned to Ana, Ben, and Clara; Leo has no assignments; Jordan is pending. Ana and Ben have sessions, while Clara starts empty. Existing local attendance is preserved by the one-time roster update.

Local records persist in `.local-demo/postgres` on this computer and are ignored by Git and Vercel uploads. Stop the server before moving/removing this directory to reset fictional data. Automated browser tests use a new temporary database each run and do not reset your walkthrough records.

The normal `pnpm dev` command uses Supabase. With missing configuration it displays a setup message instead of pretending Google authentication works.

### Suggested five-minute walkthrough

1. Enter as Maya. Open Ana's assignment. Record a session with a past date and whole minutes.
2. Select August 2026 in the Month dropdown; totals and history update automatically. Review the totals and session history.
3. Correct an August entry. Observe the updated total.
4. Record an achievement, such as reading to children, with a past attainment date.
5. Sign out; enter as Sam. Inspect daily tutor/student sessions on Activity summary. Use Current month to return to today’s month, and the Activity summary back link to return from staff pages. Open Monthly reports, select August, and download summary, detail, and achievement CSVs.
6. Open People & assignments. Approve the pending tutor, create a student, and connect an approved tutor to that student.
7. In a separate tutor session, try another tutor's assignment URL or a staff CSV endpoint: access must be denied.

The seed dates follow the supplied FY 2026–2027 form. Outside that year, create/update fixtures deliberately; session dates must still obey the current New York calendar. There is no production clock override.

## Verify locally

```sh
pnpm db:types
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium  # needed if Chromium/Chrome is unavailable
pnpm test:e2e
```

Browser tests use installed Chrome locally and downloaded Chromium in CI. Stop any existing Next.js development server before `test:e2e`: Next.js permits only one dev process per project build directory.

`pnpm db:types` replays migrations in embedded PostgreSQL and generates table/function signatures from its actual catalog. Types are generated, not a hand-maintained parallel schema. Runtime RPC result types in `domain.ts` describe the JSON contracts. Schema tests use actual PostgreSQL RLS and functions, with an isolated `auth.uid()` identity shim. They do not verify Supabase's hosted Auth service, PostgREST transport, or concurrent sessions on a remote database.

The build uses the supported webpack option because Turbopack's PostCSS worker IPC could not bind a local port in this execution environment. This is a build-tool compatibility choice, not application behavior.

## Set up Supabase

1. Choose the Supabase organization and confirm the actual project cost before project creation. The connector requires this selection; no project is created implicitly.
2. Create a development project. Keep preview/development data separate from any eventual real-data deployment.
3. Apply every SQL file in `supabase/migrations` in order. Use the Supabase plugin's migration tool for a new hosted project or a linked CLI workflow. Review CLI `--help` before invoking version-sensitive commands.
4. Run `supabase/seed.sql` only against a fictional-data development/demo project. It creates a term, students, and goal labels, but no Auth users or privileged accounts.
5. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Set `APP_URL` to the current app origin. Never put a secret/service-role key in a `NEXT_PUBLIC_` variable.
6. Configure Google Auth as described below. Sign in once to create the pending membership through the Auth trigger.
7. Verify the intended account in Supabase Auth. Using an operator connection, promote only its verified user ID:

```sql
-- Replace with the Auth user ID you have verified; never use a public form for this.
update public.memberships
set role = 'staff', status = 'active'
where user_id = '<verified-auth-user-uuid>';
```

8. Additional tutors sign in with Google and appear pending. Staff approve them and create assignments in the application.
9. Run Supabase security/performance advisors and authenticated API checks. Verify tutor isolation, direct-write denial, disabled membership access, and report behavior on the hosted project before sharing it.

No elevated key is needed for normal app runtime. Supabase requests use the signed-in user's token. Tables permit authorized reads; writes go through named invoker RPC wrappers around narrowly checked private implementations. This is intentional: raw table writes cannot bypass version-conflict and validation rules.

## Configure Google sign-in

1. In Google Auth Platform, create/select a web OAuth client and configure its audience. Request only OpenID, email, and profile scopes.
2. Put the client ID and secret into the Supabase Google-provider settings, not chat, source code, or the browser bundle.
3. Register the exact Supabase provider callback URL shown by that project's dashboard as a Google authorized redirect URI.
4. In Supabase URL configuration, allow the app's `/auth/callback` URL for each intended environment and set its Site URL.
5. Set `APP_URL` to the canonical app origin in each environment. For preview OAuth testing, prefer a stable preview origin rather than allowing arbitrary redirect destinations.
6. Test with the intended reviewer account. Google test audiences and deployment protection can prevent reviewer access even when your own account succeeds.

The callback accepts only an internal return path and the SSR proxy refreshes cookies with private/no-store cache headers. Authenticated pages are rendered dynamically. Google identifies the user; protected membership and assignment rules authorize access.

## Deploy on Vercel

1. Authenticate the Vercel CLI or use a working deployment connector. The connected account's existing unrelated project must not be reused.
2. Link/create a dedicated Gather project. Set its Node runtime to the supported version and use the committed pnpm lockfile.
3. Configure the two public Supabase values and `APP_URL` for the target environment. Do not set `LOCAL_DEMO` in Vercel; the local path is disabled there regardless.
4. Apply compatible database migrations before deploying dependent code. Application builds do not reset or migrate a shared database automatically.
5. Deploy a preview first. Confirm provider URLs, actual Google login/logout, expiry refresh, tutor/staff access, and CSV downloads. Inspect Vercel and Supabase logs without printing tokens or student details.
6. Create the stable demo deployment with its own correct build-time configuration. Do not promote a preview artifact compiled with development database values into another data environment.
7. Share the URL only after reviewer access and the complete workflow have been verified.

Repository deployment settings are in `vercel.json`. The GitHub Actions workflow runs schema generation, lint, types, unit/database tests, build, and browser tests; it does not provision paid resources or publish automatically.

## Maintenance and deliberate limits

- Use SQL migrations for schema/policy changes. Avoid remote-only changes that cannot be replayed.
- Ending an assignment retains records. Voiding removes an event from report totals but preserves its history.
- Reports are live snapshots at query time. Separate downloads may differ if someone edits between them.
- The workspace RPC reads all authorized workspace records as JSON for this small first release. Reports aggregate in SQL and do not truncate at the Data API row cap. Before a larger rollout, replace full-workspace reads with paginated, route-specific queries and load-test exports.
- PGlite serializes local work. Hosted multi-connection concurrency, provider integration, account limits, backups, and recovery remain deployment validation responsibilities.
- Re-seeding fictional records is not a backup strategy. Establish real-data backup/restore and retention requirements before actual nonprofit use.
- AI/agent tooling is used in development. No student records are sent to an AI service by the application.

Primary references: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs), [Google provider](https://supabase.com/docs/guides/auth/social-login/auth-google), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Vercel environments](https://vercel.com/docs/deployments/environments).

## Shared reviewer demo

The dedicated Gather demo permits every authenticated Google account to explore
all four fictional personas at `/demo`. Each workspace has a Switch demo account
link. Reviewers share the sample records and may modify them; never load real
student data into this deployment.

The migration defaults this feature to OFF. After applying migrations and
`supabase/seed.sql`, an operator may explicitly run `supabase/demo.sql` on the
fictional-data demo project. It seeds non-login example identities, assignments,
and attendance, then enables `private.demo_settings`. To restore normal access:

```sql
update private.demo_settings set enabled=false where singleton;
```

Google reviewers keep their real Supabase sessions. A database helper checks a
server-maintained Google identity before mapping a request's `x-gather-persona`
header to one of four operator-controlled example identities. Without that check,
the header cannot confer access. All existing role checks, validation, RLS, and
RPC write rules use the resolved acting identity; no service-role runtime key or
PostgreSQL role switch is used. The persona cookie chooses a demo view, not an
OAuth identity. Example records attribute edits to the example persona.

A restrictive membership policy hides actual reviewer profiles from demo staff,
and membership mutations reject non-example accounts. Anonymous users cannot
read records or call mutation RPCs. Turning demo mode off restores the original
pending approval behavior without altering reviewers' real membership roles.

The four example Auth rows have no password or OAuth identities. They cannot be
used for Google login; only a verified Google reviewer can act through them.
Do not modify the Google OAuth client or rotate credentials to enable this feature.

### Demo guest access

Enable **Allow anonymous sign-ins** in Supabase Authentication → Sign In / Providers for the fictional demo. The login page offers Google or Continue as guest. Guest sessions use Supabase anonymous authentication and the same restricted fictional personas; disabling `private.demo_settings.enabled` hides the button and denies guest access at the database layer. Real deployments should disable anonymous sign-ins and require Google OAuth (or a client-approved authentication integration). Anonymous accounts consume Auth quota and do not expire automatically; review and clean them up as part of demo maintenance.
