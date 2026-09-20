# Gather · Tutor session reporting

A first-version implementation for the Columbia Software Solutions take-home: tutors record attendance and achievements; staff manage assignments, review monthly attendance, and export reports.

**Stack:** Next.js App Router, strict TypeScript, Supabase PostgreSQL/Auth, Google OAuth, Tailwind CSS, selected shadcn/ui components, Zod, and Vercel deployment configuration.

## Try it locally

```sh
pnpm install --frozen-lockfile
pnpm dev:demo
```

Open http://localhost:3000. Enter as a fictional tutor or staff member. The local walkthrough persists data in embedded PostgreSQL and runs the same SQL operations and RLS policies as the Supabase path. Its persona entry points are disabled in production and on Vercel.

For Google sign-in with Supabase, copy `.env.example` to `.env.local`, configure a project and OAuth provider, then run `pnpm dev`. See the setup guide before provisioning anything.

## Implemented workflows

- Tutor session entry, corrections, voiding, duplicate-request protection, and conflict detection.
- Live monthly totals, including assignments with zero recorded sessions.
- Staff approval/pausing of tutors, student records, assignments, site/schedule, and ended tutoring.
- Internal absence/holiday codes and dated student achievements using the source form's goals.
- SQL monthly aggregation and summary, detail, and achievement CSV downloads.
- Database-enforced permissions and dynamic, private authenticated pages.
- Staff monthly activity grid with daily session counts and tutor/student details. Tutors use a compact month filter.
- Responsive tutor/staff interfaces with explicit saved, error, loading, and empty states.

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

**Deployment status:** Supabase and Google OAuth configuration and Vercel authentication must be completed before the hosted application can be verified. Local demo results do not establish hosted authentication or production readiness.
