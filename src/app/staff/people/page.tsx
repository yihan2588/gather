import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { staffContext } from "@/lib/data";
import { today, displayDate } from "@/lib/domain";
import { Shell, PageHeader, Empty } from "@/components/shell";
import { ActionForm } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight } from "lucide-react";
export default async function People({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ended_since?: string }>;
}) {
  const { member, data } = await staffContext();
  const filters = await searchParams;
  const visibleAssignments = data.assignments.filter((a) => {
    const ended =
      (a.ends_on ?? data.terms.find((t) => t.id === a.term_id)!.ends_on) <
      today();
    return (
      (filters.status !== "ended" || ended) &&
      (filters.status !== "current" || !ended) &&
      (!filters.ended_since ||
        (a.ends_on !== null && a.ends_on >= filters.ended_since))
    );
  });
  const tutors = data.memberships.filter((m) => m.role === "tutor");
  return (
    <Shell member={member} active="/staff/people">
      <Link href="/staff" className="back-link">
        <ArrowLeft size={15} /> Back to Activity summary
      </Link>
      <PageHeader title="People & assignments" />
      <section className="panel">
        <div className="section-heading">
          <h2>Volunteer tutors</h2>
          <span className="muted">{tutors.length} accounts</span>
        </div>
        {!tutors.length && (
          <Empty title="No tutor accounts">
            Tutors appear here after their first Google sign-in.
          </Empty>
        )}
        {tutors.map((t) => (
          <div key={t.user_id} className="person-row">
            <span className="avatar">
              {t.display_name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
            <div>
              <strong>{t.display_name}</strong>
              <small>
                <Badge variant="secondary">{t.status}</Badge>
                {" · "}
                {
                  new Set(
                    data.assignments
                      .filter(
                        (a) =>
                          a.tutor_id === t.user_id &&
                          a.starts_on <= today() &&
                          (a.ends_on ??
                            data.terms.find((term) => term.id === a.term_id)!
                              .ends_on) >= today(),
                      )
                      .map((a) => a.student_id),
                  ).size
                }{" "}
                students assigned
              </small>
            </div>
            <ActionForm
              operation="set_membership"
              hidden={{
                user_id: t.user_id,
                status: t.status === "active" ? "disabled" : "active",
              }}
              label={t.status === "active" ? "Pause access" : "Approve access"}
              danger={t.status === "active"}
            />
          </div>
        ))}
      </section>
      <div className="detail-grid">
        <section className="panel">
          <h2>Add a student</h2>

          <ActionForm
            operation="save_student"
            reset
            label="Add student"
            fields={[
              { name: "display_name", label: "Student name", required: true },
            ]}
          />
        </section>
        <section className="panel">
          <h2>Assign a tutor</h2>
          {data.terms.length &&
          tutors.some((t) => t.status === "active") &&
          data.students.length ? (
            <ActionForm
              operation="save_assignment"
              reset
              label="Create assignment"
              fields={[
                {
                  name: "tutor_id",
                  label: "Tutor",
                  required: true,
                  options: tutors
                    .filter((t) => t.status === "active")
                    .map((t) => ({ value: t.user_id, label: t.display_name })),
                },
                {
                  name: "student_id",
                  label: "Student",
                  required: true,
                  options: data.students.map((s) => ({
                    value: s.id,
                    label: s.display_name,
                  })),
                },
                {
                  name: "term_id",
                  label: "Term",
                  required: true,
                  options: data.terms.map((t) => ({
                    value: t.id,
                    label: t.name,
                  })),
                },
                {
                  name: "starts_on",
                  label: "Start date",
                  type: "date",
                  value: today(),
                  required: true,
                },
                {
                  name: "site",
                  label: "Tutoring site",
                  value: "Bloomfield Public Library",
                },
                { name: "usual_days", label: "Usual days" },
                { name: "usual_times", label: "Usual times" },
              ]}
            />
          ) : (
            <p className="muted">
              A program year, approved tutor, and student are needed to create
              an assignment.
            </p>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Student directory</h2>
        </div>
        <form method="get" className="form-grid">
          <div className="field">
            <label htmlFor="assignment-status">Assignment status</label>
            <select
              id="assignment-status"
              name="status"
              defaultValue={filters.status ?? ""}
            >
              <option value="">All assignments</option>
              <option value="current">Current / upcoming</option>
              <option value="ended">Ended</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="ended-since">Ended on or after</label>
            <input
              id="ended-since"
              type="date"
              name="ended_since"
              defaultValue={filters.ended_since ?? ""}
            />
          </div>
          <button type="submit" className="back-link">
            Filter assignments →
          </button>
        </form>
        {data.students.map((s) => (
          <div key={s.id} className="directory-item">
            <Link href={`/staff/students/${s.id}`} aria-label={s.display_name}>
              <strong>{s.display_name}</strong>
              <ArrowUpRight size={16} />
            </Link>
            {visibleAssignments
              .filter((a) => a.student_id === s.id)
              .map((a) => (
                <Link
                  className="assignment-line"
                  href={`/tutor/assignments/${a.id}`}
                  key={a.id}
                >
                  <span>
                    {
                      data.memberships.find((m) => m.user_id === a.tutor_id)
                        ?.display_name
                    }{" "}
                    · {displayDate(a.starts_on)}
                    {a.ends_on ? ` – ${displayDate(a.ends_on)}` : ""}
                  </span>
                  <span>
                    {a.ends_on && a.ends_on < today()
                      ? `Ended · ${a.end_reason ?? ""}`
                      : "View assignment"}{" "}
                    →
                  </span>
                </Link>
              ))}
            {!visibleAssignments.some((a) => a.student_id === s.id) && (
              <p className="muted">No assignments match this view</p>
            )}
          </div>
        ))}
      </section>
    </Shell>
  );
}
