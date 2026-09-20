import Link from "next/link";
import { MonthSelector } from "@/components/month-selector";
import { monthsBetween } from "@/lib/activity";
import { notFound } from "next/navigation";
import { context } from "@/lib/data";
import { today, hours, displayDate, monthLabel, kindLabel } from "@/lib/domain";
import { Shell, PageHeader, Stat, Empty } from "@/components/shell";
import { ActionForm } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Clock3, CalendarDays, ArrowLeft, MapPin } from "lucide-react";
import { AchievementPanel } from "@/components/achievements";
export default async function Assignment({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { member, data } = await context();
  const a = data.assignments.find((a) => a.id === id);
  if (!a) notFound();
  const s = data.students.find((s) => s.id === a.student_id)!;
  const term = data.terms.find((t) => t.id === a.term_id)!;
  const query = await searchParams;
  const months = monthsBetween(term.starts_on, term.ends_on);
  const month = months.includes(query.month ?? "")
    ? query.month!
    : months.includes(today().slice(0, 7))
      ? today().slice(0, 7)
      : months[months.length - 1];
  const events = data.events.filter(
    (e) => e.assignment_id === id && e.occurred_on.startsWith(month),
  );
  const minutes = events
    .filter((e) => !e.voided_at && e.kind === "completed")
    .reduce((sum, e) => sum + e.duration_minutes, 0);
  const staff = member.role === "staff";
  const maxDate = [today(), a.ends_on ?? term.ends_on].sort()[0];
  const kinds = Object.entries(kindLabel)
    .filter(([key]) => staff || key === "completed")
    .map(([value, label]) => ({ value, label }));
  return (
    <Shell member={member} active={staff ? "/staff/people" : "/tutor"}>
      <Link href={staff ? "/staff/people" : "/tutor"} className="back-link">
        <ArrowLeft size={15} /> Back to {staff ? "people" : "my students"}
      </Link>
      <PageHeader
        title={s.display_name}
        description={`${term.name} · ${a.usual_days || "Flexible schedule"}${a.usual_times ? ` · ${a.usual_times}` : ""}`}
        action={
          <Badge variant="secondary">
            <MapPin size={14} />
            {a.site || "Site unspecified"}
          </Badge>
        }
      />
      <MonthSelector
        month={month}
        months={months}
        currentMonth={today().slice(0, 7)}
      />
      <div className="stats-grid two">
        <Stat
          label="Hours this month"
          value={hours(minutes)}
          icon={<Clock3 size={20} />}
        />
        <Stat
          label="Completed sessions"
          value={
            events.filter((e) => !e.voided_at && e.kind === "completed").length
          }
          icon={<CalendarDays size={20} />}
        />
      </div>
      <div>
        <section className="panel">
          <div className="section-heading">
            <h2 data-tour="record-session">Record a session</h2>
          </div>
          <ActionForm
            operation="create_attendance"
            hidden={{ assignment_id: id }}
            reset
            label="Save session"
            duplicates={data.events.filter(
              (e) => e.assignment_id === id && !e.voided_at,
            )}
            fields={[
              {
                name: "occurred_on",
                label: "Session date",
                type: "date",
                value: maxDate,
                min: a.starts_on,
                max: maxDate,
                required: true,
              },
              {
                name: "duration_minutes",
                label: "Duration (minutes)",
                type: "number",
                value: 60,
                min: 0,
                max: 1440,
                required: true,
              },
              {
                name: "kind",
                label: "Attendance type",
                value: "completed",
                options: kinds,
                required: true,
              },
            ]}
          />
          <p className="field-hint">
            Record tutoring time only; exclude homework.
            {staff && " Absence and holiday entries require 0 minutes."}
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Session history</h2>
          <span className="muted">{monthLabel(month)}</span>
        </div>
        {!events.length && <Empty title="No entries for this month" />}
        {events.map((e) => (
          <div
            key={e.id}
            className={`event-row ${e.voided_at ? "voided" : ""}`}
          >
            <div className="event-summary">
              <div>
                <strong>{displayDate(e.occurred_on)}</strong>
                <small>
                  {kindLabel[e.kind]}
                  {e.voided_at ? ` · Voided: ${e.void_reason}` : ""}
                </small>
              </div>
              <strong>
                {e.duration_minutes} <span className="muted">min</span>
              </strong>
            </div>
            {!e.voided_at && (staff || e.kind === "completed") && (
              <div className="record-actions">
                <details>
                  <summary>Edit entry</summary>
                  <ActionForm
                    operation="edit_attendance"
                    hidden={{ id: e.id, expected_version: e.version }}
                    label="Save correction"
                    fields={[
                      {
                        name: "occurred_on",
                        label: "Date",
                        type: "date",
                        value: e.occurred_on,
                        min: a.starts_on,
                        max: maxDate,
                        required: true,
                      },
                      {
                        name: "duration_minutes",
                        label: "Minutes",
                        type: "number",
                        value: e.duration_minutes,
                        min: 0,
                        max: 1440,
                        required: true,
                      },
                      {
                        name: "kind",
                        label: "Type",
                        value: e.kind,
                        options: kinds,
                      },
                    ]}
                  />
                </details>
                <details>
                  <summary>Void entry</summary>
                  <p>
                    Remove this entry from report totals while keeping its
                    history.
                  </p>
                  <ActionForm
                    operation="edit_attendance"
                    hidden={{ id: e.id, expected_version: e.version }}
                    label="Confirm void"
                    danger
                    fields={[
                      {
                        name: "void_reason",
                        label: "Reason for voiding",
                        required: true,
                      },
                    ]}
                  />
                </details>
              </div>
            )}
          </div>
        ))}
      </section>
      <AchievementPanel
        data={data}
        member={member}
        studentId={s.id}
        termId={term.id}
      />
      <section className="panel">
        <details>
          <summary>
            {staff
              ? "Assignment details & ending tutoring"
              : "Report stopped tutoring"}
          </summary>
          {staff && (
            <p>
              {displayDate(a.starts_on)} –{" "}
              {a.ends_on ? displayDate(a.ends_on) : "Term end"}
              {a.end_reason ? ` · ${a.end_reason}` : ""}
            </p>
          )}
          <p className="field-hint">
            Record when tutoring with this student stopped and why. Previous
            sessions remain in the reports.
          </p>
          <ActionForm
            operation="save_assignment"
            hidden={{
              id: a.id,
              expected_version: a.version,
              starts_on: a.starts_on,
            }}
            label={staff ? "Update assignment" : "Report tutoring stopped"}
            fields={[
              ...(staff
                ? [
                    {
                      name: "starts_on",
                      label: "Start date",
                      type: "date",
                      value: a.starts_on,
                      required: true,
                    },
                    { name: "site", label: "Tutoring site", value: a.site },
                    {
                      name: "usual_days",
                      label: "Usual days",
                      value: a.usual_days,
                    },
                    {
                      name: "usual_times",
                      label: "Usual times",
                      value: a.usual_times,
                    },
                  ]
                : []),
              {
                name: "ends_on",
                label: "End date",
                type: "date",
                value: a.ends_on ?? "",
                min: a.starts_on,
                max: staff ? term.ends_on : today(),
                required: !staff,
              },
              {
                name: "end_reason",
                label: "Reason if ending",
                type: "textarea",
                value: a.end_reason ?? "",
              },
            ]}
          />
        </details>
      </section>
    </Shell>
  );
}
