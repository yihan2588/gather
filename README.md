# Gather · Tutor session reporting

**Stack:** Next.js App Router, strict TypeScript, Supabase PostgreSQL/Auth, Google OAuth, Tailwind CSS, selected shadcn/ui components, Zod, and Vercel deployment configuration.

## Try it locally

```sh
pnpm install --frozen-lockfile
pnpm dev:demo
```

Open http://localhost:3000. Enter as a fictional tutor or staff member. The local walkthrough persists data in embedded PostgreSQL and runs the same SQL operations and RLS policies as the Supabase path. Its persona entry points are disabled in production and on Vercel.

For Google sign-in with Supabase, copy `.env.example` to `.env.local`, configure a project and OAuth provider, then run `pnpm dev`. See the setup guide before provisioning anything.

## Implemented workflows

### Tutors: record sessions and track student progress

1. After staff approval and assignment, open **My students** to see assigned students and their tutoring schedules.
2. Select a student to record a session date and duration, or add a dated achievement using the source form's goals.
3. Choose a month to review sessions and total hours. Correct an entry or void a mistake without erasing its history. Students with no recorded sessions remain visible.

### Staff: organize tutoring and prepare monthly reports

1. Open **Activity summary** for a monthly overview. Select a day to see its tutor–student pairs and session durations.
2. Use **People & assignments** to approve or pause tutors, maintain student records, assign tutors, and set meeting sites and schedules. Record when a tutoring assignment ends.
3. Review a student's records, make corrections, and record internal absence or holiday codes when needed.
4. Open **Monthly reports**, select the month and filters, and download attendance summaries, session details, or student achievements as CSV files. Totals update from recorded sessions, including assignments with zero sessions.

### Access and safeguards

In normal use, new accounts wait for staff approval; approved tutors access their assigned records, while staff manage the program. The demo lets reviewers sign in with Google or continue as a guest, then switch between fictional tutor, staff, and pending accounts.

Database permissions protect records. Duplicate-request protection prevents retries from saving the same session twice, and conflict detection prevents silently overwriting another edit. Both interfaces support mobile screens and show saved, error, loading, and empty states.

## Read the project

1. [Implementation specification](docs/02-implementation-spec.md): behavior, policies, scope, and acceptance scenarios.
2. [Run and deploy](docs/03-running-and-deploying.md): local walkthrough, Supabase/Google setup, Vercel handoff, and operational limits.

The source form at `/Users/yihanwu/Downloads/Student Attendance & Achievement Form.pdf` was preserved. Product-policy assumptions remain proposals, not confirmed LVAEP policies.

## Check changes

```sh
pnpm db:types
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Stop the development server before browser tests. CI installs Chromium; local tests use installed Chrome. No live provider credentials are required for local database/browser tests.

**Hosted demo:** https://gather-yihan2588.vercel.app — dedicated Supabase and Vercel projects are configured. Google reviewers can choose tutor or staff example accounts in the shared fictional-data walkthrough. See the [setup guide](docs/03-running-and-deploying.md#shared-reviewer-demo) for the explicit demo access mode.
