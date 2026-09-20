# Tutor Session Reporting: implementation specification

Status: implementation contract, updated September 19, 2026. The user removed attendance confirmation/completeness from the MVP. Other product-policy defaults remain assumptions, not client-approved policies.

## 1. Goal and scope

Deliver a deployed single-organization application where approved tutors record attendance for assigned students and staff produce correct monthly reports. Demonstrate a complete, explainable workflow with fictional data.

### Requirements provenance

| Source | Requirement |
|---|---|
| Take-home brief | Assigned tutors/students, session date and hours, monthly staff reporting |
| Supplied FY 2026–2027 form | July–June reporting, per-student attendance, internal absence/holiday codes, achievements, stopped tutoring, site and usual schedule |
| User decision | Supabase database, Vercel deployment, Google OAuth, conventional best practices, agent-assisted implementation |
| Proposed design | Staff approval, role permissions, CSV contracts, correction/version behavior |

Source form: `/Users/yihanwu/Downloads/Student Attendance & Achievement Form.pdf`. Preserve it unchanged. Confirm exact achievement labels from the source during implementation; do not invent the meaning of its asterisks.

### Delivery scope

**Core release:** Google sign-in; pending/approved access; staff roster and assignment management; tutor session create/edit/void; monthly totals, summary and detail CSVs; tested permissions; responsive UI; reproducible setup and hosted demo.

**Form coverage required before claiming a full workflow replacement:** staff absence/holiday entries, site/schedule fields, student achievement tracking and export, stopped-assignment date/reason. These follow the working core in the delivery sequence.

**Deferred:** exact PDF facsimile, paper import/OCR, email/SMS reminders, offline synchronization, scheduling/calendar integration, student accounts, group tutoring, multiple organizations, AI-generated records, immutable regulatory report archives, homework credit calculation.

The completed submission should include core and form coverage. If available time forces a cut, describe it explicitly; do not call an omitted form feature implemented.

## 2. Defaults and unresolved client questions

These defaults unblock the build. They are not facts established by the client.

| Topic | Build default | Question for a real rollout |
|---|---|---|
| Program | One organization, one-to-one sessions | Are group/co-taught sessions needed? |
| Login | Google only; staff approval after first login | Can every intended tutor use Google? |
| Time | America/New_York; date-only attendance | Is another program timezone needed? |
| Periods | Terms with explicit dates; seed July 1, 2026–June 30, 2027 | Is the fiscal year also the assignment term? |
| Hours | Whole minutes, 1–1440 per completed event | Are increments or different maximums required? |
| Homework | Excluded, visibly documented | What credit is allowed and how is it distinguished? |
| Absences | Staff enters TA, SA, H, all zero minutes | May tutors enter these codes? |
| Ending tutoring | Tutor may end own assignment with reason; staff may correct | Should this require staff approval? Does it mean student departure? |
| Reports | Live data at export time, CSV | Must submitted historical reports remain immutable? |
| Historical access | Approved tutor retains own assignment history | What is the real retention and revocation policy? |

Deadline, available work hours, service budget, and account/project IDs remain unknown. Estimate scheduling after the first vertical slice. Do not provision paid resources based on this document alone.

## 3. User flows and screens

| Route | Audience | Required behavior |
|---|---|---|
| `/login` | Everyone | Google sign-in, concise explanation, useful cancellation/failure state |
| `/auth/callback` | Authentication flow | Exchange code using supported Supabase SSR flow; allow only validated internal return paths |
| `/pending` | Pending/disabled users | Explain state; show no student information |
| `/tutor` | Tutor | Assigned student cards, current-month summary, recent entries, log-session action |
| `/tutor/assignments/[id]` | Owning tutor or staff | Attendance history, entry/edit/void, site/schedule, end-assignment action, month filtering |
| `/staff` | Staff | Monthly daily-session heatmap; links to People & assignments and Monthly reports |
| `/staff/people` | Staff | Approve/disable tutors; maintain students and assignments |
| `/staff/reports` | Staff | Term/month selector, student/tutor filter, totals, drill-down, exports |
| `/staff/students/[id]` | Staff | Student record, assignment history, achievements |
| `/api/reports/attendance.csv` | Staff | Authorized summary or detail CSV according to explicit format parameter |
| `/api/reports/achievements.csv` | Staff | Authorized student-level achievements for selected month |

Interface refinement (September 19): use concise task labels rather than motivational banners or repeated explanations. Staff navigation has two destinations, People & assignments and Monthly reports; the Gather logo returns to the activity landing page. Tutor assignment pages use a compact month filter for totals and history; they do not show an activity grid. Staff cells show session count and list each tutor/student pair with duration. Exclude voided and non-session entries. Preserve all calendar days, including empty days and leap days.

The source form explicitly asks tutors to mark STOPPED and give a reason when a student is no longer being tutored. Retain this as a collapsed **Report stopped tutoring** action, without staff assignment-editing controls in the tutor view. The form supports reporting cessation; it does not establish broader program termination authority.

Local walkthrough roster: Maya has Ana, Ben, and Clara; Leo has no students; Jordan awaits approval. Ana and Ben have sessions; Clara starts empty. A versioned local fixture update preserves saved attendance and runs once. These are local examples, not changes to hosted data.

Tutor assignment pages expose permitted achievement actions without requiring the staff route. Tutors do not need a second general student-management interface.

Forms retain values on failure, show field errors, disable repeat clicks while saving, and announce success only after persistence. Empty states distinguish no assignments, no entries, no results, and unavailable data. Do not render a failed query as a zero total.

Use semantic labels, keyboard-operable controls, visible focus, accessible error/status announcements, and status text in addition to color. Verify at 375 px and 1280 px widths without page-level horizontal overflow. Staff tables may have a clearly contained horizontal scroll area.

## 4. Stack and code responsibilities

| Area | Decision |
|---|---|
| App | Next.js App Router, React, strict TypeScript, Node runtime |
| UI | Tailwind CSS, selected shadcn/ui components; ordinary form state initially |
| Auth/data | `@supabase/supabase-js`, `@supabase/ssr`, generated database types |
| Validation | Zod at request boundaries; database constraints for persistent invariants |
| Reporting | SQL aggregation; one report function consumed by UI and export |
| Testing | Vitest, Playwright, local Supabase integration tests/pgTAP where appropriate |
| Delivery | pnpm lockfile, GitHub Actions checks, Vercel deployment, SQL migrations |

Select compatible stable versions from official docs at kickoff, pin direct dependencies and runtime/package-manager versions, and commit the lockfile. Do not select canary releases to obtain optional features.

Suggested structure; create only directories that have actual responsibilities:

```text
src/app/                    routes, server actions, pages, loading/error UI
src/components/ui/          selected shared UI primitives
src/features/attendance/    forms, validation, presentation
src/features/reporting/     report contracts, filters, CSV serialization
src/features/people/        roster and assignment UI
src/lib/supabase/           browser/server clients and session integration
src/lib/auth/               server identity and membership checks
src/lib/database.types.ts   generated, not manually edited
supabase/migrations/        schema, privileges, policies, functions
supabase/seed.sql           deterministic fictional domain fixtures
tests/unit/                pure rules and serialization
tests/integration/         database permissions and transactions
tests/e2e/                 tutor and staff browser journeys
docs/                      rationale, specification, setup and demo evidence
```

Keep routes thin. Put shared behavior in named functions with explicit inputs/outputs. Use Server Components for initial reads, Client Components for interaction, Server Actions for forms, and Route Handlers for callback/download responses. Server-only modules must not be imported into client bundles. No separate Express service, ORM, Redis, or realtime subscription is required.

## 5. Logical database contract

Use UUID primary keys, foreign keys, explicit constraints, and database-generated audit timestamps. Do not hard-delete referenced domain records or auth users through the app. Disable access or end assignments instead.

| Table | Essential fields and rules |
|---|---|
| `memberships` | `user_id` references Auth user, `display_name`, `role` tutor/staff, `status` pending/active/disabled; only staff/operator can change role/status |
| `terms` | `id`, `name`, `starts_on`, `ends_on`; end >= start |
| `students` | `id`, `display_name`, audit timestamps; names need not be unique |
| `assignments` | `id`, `tutor_id`, `student_id`, `term_id`, `starts_on`, nullable `ends_on`, `end_reason`, optional `site`, `usual_days`, `usual_times`, `version` |
| `attendance_events` | `id`, `assignment_id`, `occurred_on`, `kind`, `duration_minutes`, `request_id`, protected immutable `creation_payload` for retry comparison, `created_by`, `updated_by`, timestamps, `version`, nullable `voided_at`, `voided_by`, `void_reason` |
| `goal_types` | Seeded code, category, exact source label, display order, source asterisk flag |
| `student_achievements` | `id`, `student_id`, `term_id`, `goal_type_id` or custom label, `attained_on`, `recorded_by`, timestamps, `version`, void metadata |

Auth provider secrets and refresh tokens are not duplicated into these domain tables. Avoid unrelated demographic information and unrestricted student notes.

### Relationships and indexes

- An assignment interval must lie within its term. Tutor/student/term identity is immutable after creation; corrections requiring another identity void affected entries and use the correct assignment.
- Prevent overlapping assignments for the same tutor/student within a term. Different tutors may have separate assignments to one student; group/co-taught sessions are out of scope.
- Events must fall within the assignment's effective inclusive interval, including term end when `ends_on` is null. Enforce cross-table rules at the database boundary.
- Reject shortening an assignment interval past existing non-voided events. Require correction of those events first.
- Index assignment tutor/student references and attendance `(assignment_id, occurred_on)`. Add indexes used by policy lookups. Assess further indexes with query plans against fixtures.
- Enforce unique `(created_by, request_id)` for event creation. Do not make `(assignment_id, occurred_on)` unique.
- Named goals have one non-voided attainment per student/term/goal. Custom goals are separate named entries. Attainment date belongs to the term and cannot be future-dated.

## 6. Authentication and authorization contract

Use Supabase Auth's Google provider and supported SSR cookie integration. Validate the authenticated identity on the server using the current documented mechanism; do not trust an unverified session object. Membership status is read from protected database data, not user-editable metadata. An absent membership behaves as pending.

First login provisions a pending tutor membership through a controlled path. Bootstrap the first staff member with a documented operator procedure after verifying the intended Auth user ID. Staff can approve/disable tutors; further staff promotion is an operator task in this release. No public role picker.

| Action/data | Pending/disabled | Active tutor | Staff |
|---|---|---|---|
| Own membership status | Read | Read | Read |
| Other membership records | None | None | Read/manage tutors |
| Student basic record | None | Students linked to own assignments, including history | All |
| Assignments | None | Read own; end own via checked operation | Create/read/update/end |
| Completed attendance | None | Create/edit/void own assignment entries, including backdated corrections within interval | All |
| Absence/holiday events | None | Read own assignment events only | Create/edit/void |
| Achievements | None | Read/add for currently assigned students; update/void own entries while currently assigned | All |
| Program reports/exports | None | None | All |

Ending an assignment does not disable its tutor. Disabling membership removes domain access even if a Supabase access token remains valid. A returning student gets another assignment; ending one assignment must not terminate another tutor's assignment.

Enable RLS on every exposed table and explicitly define grants. Tutor update policies check both accessible old rows and permitted new rows. Reference/goal data is available only to active members. Staff lookup policies must avoid recursive membership-policy evaluation.

Ordinary reads and calls use the user's token and publishable key. No service-role/secret key in the browser or normal attendance/report requests. Reporting views use invoker security or otherwise explicitly enforce equivalent access; do not expose a privileged view accidentally.

For controlled operations requiring protected-field updates, use narrowly scoped database functions. Prefer invoker functions; if elevated privileges are necessary, document why, isolate the privileged implementation in a private schema, set a safe search path, restrict EXECUTE grants, and check current identity/membership/ownership inside the function. Do not use a broadly privileged generic CRUD function. Test direct API calls as well as the UI.

## 7. Attendance behavior and consistency

### Entry rules

- Kinds: `completed`, `tutor_absent`, `student_absent`, `holiday`.
- Completed events have integer minutes from 1 to 1440. Other kinds have exactly zero minutes.
- Date is a calendar date, no later than today in America/New_York and inside the assignment interval. No implicit browser timezone conversion.
- Tutors create/edit/void completed events only. Staff handle the internal codes.
- Multiple same-day sessions are allowed. Warn on a matching assignment/date/duration but allow an intentional second event with a distinct request ID.
- Never silently reinterpret completed homework as tutoring minutes.

### Controlled writes

Creation, editing, voiding, and assignment interval changes must pass through checked database operations. Revoke unrestricted table writes to prevent bypassing validation/authorization logic. Document any privileged operation as above.

Create input: assignment ID, date, kind, minutes, request ID. Actor/timestamps come from trusted identity/database context. Return the persisted event ID and version.

For a retried create with the same actor/request ID and identical creation payload, return the existing record without another insert. Reject reuse with different creation input. Preserve enough immutable creation metadata to check this even if the record has since been edited. Check retry access before returning data. A new intentional record gets a new request ID.

Edit/void inputs include `expected_version`; only update if it matches. Otherwise return a conflict requiring refresh. Event assignment and creator are immutable. An edit can change date within the assignment; invalidate both affected months when it crosses a month boundary. Void requires a reason, retains history, and excludes the event from totals. No restoration UI in this release.

Return consistent outcomes: validation error with field details, unauthenticated, forbidden/not-found without leaking another user's record, conflict, or unexpected failure with a correlation ID. Do not return raw SQL errors or secrets.

### Monthly totals

Start reports from assignments whose effective interval overlaps the selected month, so assignments with zero recorded sessions still appear. Totals are calculated from non-voided events. There is no completeness status, confirmation action, submission deadline, or month revision. Corrections update the live totals. Event versions still protect against stale edits, and assignment row locks coordinate event writes with interval changes.

## 8. Reporting and export contract

Inputs: `term_id`, calendar `month` as YYYY-MM, optional tutor/student IDs. Reject months outside the term. All reports are staff-only and use an explicit authorized query.

### Attendance summary

One row per overlapping assignment, including zero-entry assignments. Fields:

`term_id, month, assignment_id, tutor_id, tutor_name, student_id, student_name, completed_sessions, total_minutes, total_hours, tutor_absences, student_absences, holidays, site, assignment_ends_on, end_reason`.

Count only non-voided completed events as sessions; sum only their minutes. Display hours to two decimals but retain exact minutes in the export. Overall hours derive from summed minutes, not rounded per-row hours. Distinct students use student IDs; do not sum row counts. The one-to-one assumption means these are recorded tutoring hours, not deduplicated clock time across co-tutors.

Reports include all applicable records. UI totals follow the selected filters and label that scope. Obsolete status query parameters do not restrict results.

### Attendance detail and achievements

Detail CSV: one non-voided attendance event per row with event/assignment/tutor/student IDs and names, date, kind, minutes, creator, creation time, last editor/time, and current version. Respect the same assignment filters as summary. Voided entries remain visible in authorized history, outside ordinary report totals.

Achievement CSV: one non-voided attainment per row in the selected term/month by `attained_on`, with student ID/name, goal code/category/label, attainment date, and recorder. Query at student level; do not join to multiple assignments and multiply achievements. The tutor filter does not filter student-level achievements.

Summary and detail can be exported separately. Each export is a consistent database snapshot of its own query; separately downloaded files may differ if someone edits between downloads. Reports are live, not immutable submissions. Show generated-at time and put term/month/format in the filename.

Use a single aggregation contract for dashboard and CSV. Do not total just the current UI page or accept the Supabase API's default row cap as a report limit. Aggregate in SQL and retrieve all requested detail rows with explicit pagination/streaming as needed. Never silently truncate; an oversized synchronous export must return a clear error if a documented cap is introduced.

Escape commas, quotes, and newlines. Neutralize spreadsheet formula injection in user-entered text starting with dangerous formula prefixes, including after leading whitespace. Keep numeric columns numeric. Downloads and authenticated pages must not be publicly cached.

## 9. Achievements and ending tutoring

Seed all named goal labels/categories from the supplied form, including the asterisk marker without assigning it an invented meaning. Support dated custom “Other” achievements. Tutor actions are restricted as in the permission matrix. Student-level storage avoids copying an attainment when tutors change. Preserve void history for mistaken entries.

Ending tutoring sets the assignment's inclusive end date and a required reason. The tutor sees a message explaining that existing records are retained. Staff can find ended assignments and reasons using a status/date filter; no automatic email is implied. “Student has no active assignments” may be derived for staff but is not a claim that the student left the entire program.

## 10. Representative acceptance tests

Use fictional Maya (tutor), Leo (another tutor), Ana (Maya's student), Ben (Leo's student), and Sam (staff). Freeze the test clock to October 5, 2026 for date-boundary tests.

Use dated fictional sessions for the live demonstration and fixed dates in automated tests.

| ID | Scenario | Expected result |
|---|---|---|
| A01 | New Google user signs in | Pending page; direct student/report requests denied |
| A02 | Staff approves Maya and assigns Ana | Maya sees Ana; Leo's Ben records remain inaccessible |
| A03 | Maya records Sep 10: 90 and Sep 17: 60 minutes | 2 completed sessions; 150 minutes; 2.50 hours in UI and CSV |
| A04 | Same create request retries concurrently | One event; conflicting payload rejected |
| A05 | Two intentional same-date sessions use different IDs | Both persist; duplicate warning can be acknowledged |
| A06 | Negative/fractional minutes, future date, outside interval | Rejected through UI and direct write/function calls |
| A07 | Closed September has zero entries | Staff row exists with zero sessions and hours |
| A08 | Maya changes 60 minutes to 45 | 135 minutes, 2.25 hours |
| A09 | Obsolete confirmation API called | Function unavailable; no confirmation workflow |
| A10 | Two editors save from the same event version | One succeeds; other gets conflict without overwriting |
| A11 | Date moves from Sep 30 to Oct 1 inside interval | Both month totals reflect the corrected date |
| A12 | Staff adds student absence; tutor tries same mutation | Staff event is zero minutes; tutor rejected; completed count unchanged |
| A13 | End assignment before a non-voided event | Rejected; historical totals remain unchanged |
| A14 | Maya alters student/assignment IDs or her role via API | No unauthorized read, reassignment, or privilege escalation |
| A15 | Staff disables Maya while token remains valid | Subsequent domain access denied |
| A16 | Term boundaries, leap day, timezone near midnight | Correct calendar month and valid date behavior |
| A17 | One achievement, student has two assignments | Achievement exported once; unauthorized edit rejected |
| A18 | CSV has commas, quotes, newlines, formula-like name | Well-formed safe text; exact minutes preserved |
| A19 | More than 1,000 attendance records | Full SQL totals and detail export; no default-limit truncation |
| A20 | Save/network failure and retry; keyboard/mobile use | Values retained, truthful status, one eventual event, usable controls |
| A21 | Staff views report after tutor login/logout on same browser | No stale cached cross-user data |
| A22 | Replay migrations and seed from a blank local database | Same schema/rules/fixtures and passing policy tests |
| A23 | Real deployed Google login, logout, and expired-session refresh | Correct environment callback and session handling |
| A24 | Void a saved event | Retained history, excluded totals |
| A25 | Direct API update of protected event/actor fields | Denied; controlled operations alone can set protected fields |

Database tests use real RLS contexts and transactions, not only a privileged SQL connection. For boundary and race tests, make the expected ordering/results explicit. Test a full browser tutor-to-staff-export path; separately inspect the downloaded CSV contents.

## 11. Environments, configuration, and operational handoff

- Local: Supabase CLI/local services, isolated fixtures, documented runtime setup.
- Preview: Vercel preview with a separate development Supabase project or isolated branch if supported by the chosen plan.
- Stable demo: Vercel production environment pointing to a separate demo Supabase project with fictional data.
- Inspect real accounts, plans, regions, quotas, and costs before setup. Choose nearby application/database regions where configurable. Do not promise free perpetual hosting or backups without checking the actual plan.
- Public environment variables contain only the Supabase URL and publishable key. Operator secrets stay outside client bundles and logs. Document names in `.env.example` without values.
- Configure Google's authorized callback to Supabase and Supabase's allowed return URLs to the relevant app. Prefer a stable preview URL and explicit production allowlist. Keep development callbacks separate.
- CI: frozen install, lint, typecheck, unit tests, database integration tests, build, then relevant browser tests. Document any hosted checks that require credentials.
- Test OAuth manually on the stable URL using intended reviewer access. Do not assume a Google testing audience or Vercel protection setting allows reviewers in.
- Apply and verify migrations separately from application build. Use compatible additive migrations before deploying dependent code. Do not automatically reset a shared database from a preview build.
- Deploy production from its production configuration. Do not promote a preview artifact compiled with development database configuration into the stable demo.
- Record request correlation IDs and sanitized errors. Check Vercel and Supabase logs on deployment; exclude student details and tokens from logs.
- Document demo seed reset, export, schema recovery, and app rollback. An application rollback does not reverse a database migration. Demo reseeding is not a substitute for real-data backups.

Reviewer entry must be concrete: Google login plus pre-approved reviewer identity when available, or a separately isolated fictional demo route/account strategy agreed before submission. Do not create a public staff bypass into real data. Automate application tests with test users; never automate around Google's authentication protections.

## 12. Implementation stages using engineering-loop

| Stage | Work | Exit evidence |
|---|---|---|
| 0. Scaffold | Verify docs/versions, project structure, scripts, local database, environment template | Clean install, typecheck/build; no secrets committed |
| 1. Vertical slice | Google Auth, membership, one seeded assignment, completed session, report and CSV | Maya's two sessions appear correctly in a hosted development preview |
| 2. Reliability | Checked writes, idempotency, edit conflicts, access tests | A04–A15, A24–A25 pass against real database contexts |
| 3. Form coverage | Roster UI, internal attendance codes, achievements, schedule/site, ended tutoring | Source-form mapping complete; A12–A13 and A17 pass |
| 4. Submission | Responsive/accessibility pass, export limits, isolated stable demo, setup docs and walkthrough | All applicable acceptance tests; actual hosted OAuth smoke check; limitations listed |

Before each behavior change, write or identify its expected result. Prefer a meaningful failing test for rules and permissions. Implement the smallest coherent increment. Run focused checks, then the relevant suite, then broader build/browser checks. Inspect the final diff for unrelated changes and missing edge cases.

Use the selected **Supabase plugin** for documentation, development database inspection/querying, migration verification, and advisors where callable. Use the selected **Vercel plugin** for project/environment inspection, deployments, and build/runtime diagnostics where callable. Discover current tools and confirm the target project first. Keep committed migrations authoritative; do not leave remote-only dashboard/agent changes undocumented. No cloud resources are created by this specification.

If tools are disconnected, document the exact blocked operation and use an authorized CLI/manual path where available. Tool installation is not evidence of successful project access. Agent-generated code must pass the same review and tests as manually written code.

## 13. Definition of done

- The complete core and declared form coverage work with persistent fictional data on a reachable deployment.
- An evaluator can enter as the intended tutor/staff roles without an undocumented setup dependency.
- Report minutes are traceable to events and access restrictions hold outside the UI.
- All required automated checks pass; hosted OAuth/browser checks have recorded results. Unrun checks are clearly labeled.
- Repository includes lockfile, migrations, policy tests, seed procedure, `.env.example`, run/deploy commands, architecture explanation, and known limitations.
- A short demo demonstrates entry, correction, export, and denied unauthorized access.
- Timing/usability claims are measured or labeled as goals. No claim of client approval, real deployment readiness, or supported scale exceeds evidence.

## 14. Primary references and verification boundary

Consulted official documentation for the architecture; recheck version-specific APIs when implementing:

- [Supabase changelog](https://supabase.com/changelog): inspect breaking changes relevant to installed tools. Current log-query APIs must be discovered rather than copied from older examples.
- [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase SSR client](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase testing](https://supabase.com/docs/guides/local-development/testing/overview)
- [Supabase agent tooling](https://supabase.com/docs/guides/ai-tools/mcp)
- [Next.js data security](https://nextjs.org/docs/app/guides/data-security)
- [Next.js component boundaries](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Vercel environments](https://vercel.com/docs/deployments/environments)

These sources support platform behavior. The application policies, limits, workflows, and test expectations above are our proposed design. This phase verified the documentation package only; no application tests, provider configuration, authentication flow, or deployment has yet been executed.

### Guided orientation

- Show a short tour on the first visit to each main workflow: sign-in, demo account selection, tutor overview, session recording, staff overview, people, reports, and pending access.
- The hosted demo sign-in tour explains that any Google account can explore all fictional roles. Real-use copy distinguishes Google identity verification from staff approval and role/assignment authorization. Local preview copy describes its example-account buttons instead.
- Highlight the relevant control and place a bubble nearby, with Back, Next/Got it, Skip tour, Escape dismissal, and a persistent Quick tour replay control. Tours describe actions without submitting forms or modifying records.
- Store versioned completion flags in browser local storage; no email, token, student data, or database writes. Completion is per browser, not synchronized across devices or Google accounts. If storage is unavailable, remember dismissal for the current page session and retain working navigation.
- Keep tour state separate from authentication and authorization. Normal production mode uses role-appropriate guidance and omits demo-account instructions.
