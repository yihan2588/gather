import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { staffContext, call } from "@/lib/data";
import { today, hours, monthLabel, type AttendanceReport } from "@/lib/domain";
import { Shell, PageHeader, Stat, Empty } from "@/components/shell";
import { reportFilter } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Clock3, Users, Download, ArrowUpRight } from "lucide-react";
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { member, data } = await staffContext();
  const q = await searchParams;
  const term = data.terms.find((t) => t.id === q.term_id) ?? data.terms[0];
  if (!term)
    return (
      <Shell member={member} active="/staff/reports">
        <Empty title="No reporting term yet">
          Contact your program administrator to set up a program year.
        </Empty>
      </Shell>
    );
  const fallback = [
    term.ends_on.slice(0, 7),
    [today().slice(0, 7), term.starts_on.slice(0, 7)].sort().at(-1)!,
  ].sort()[0];
  const month = q.month ?? fallback;
  const filters = {
    term_id: term.id,
    month: month + "-01",
    student_id: q.student_id ?? "",
    tutor_id: q.tutor_id ?? "",
  };
  const valid = reportFilter.safeParse(filters);
  let report: AttendanceReport | null = null;
  let error = "";
  if (
    valid.success &&
    month >= term.starts_on.slice(0, 7) &&
    month <= term.ends_on.slice(0, 7)
  )
    report = await call<AttendanceReport>("attendance_report", valid.data);
  else error = "Choose a valid month inside this term and valid filters.";
  const rows = report?.summary ?? [];
  const query = new URLSearchParams({ ...filters, month });
  const total = rows.reduce((s, r) => s + r.total_minutes, 0);
  return (
    <Shell member={member} active="/staff/reports">
      <Link href="/staff" className="back-link">
        <ArrowLeft size={15} /> Back to Activity summary
      </Link>
      <PageHeader title="Monthly reports" />
      <section className="panel filter-panel">
        <form method="get" className="report-filters">
          <div className="field">
            <label htmlFor="term">Program year</label>
            <select name="term_id" id="term" defaultValue={term.id}>
              {data.terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="report-month">Month</label>
            <input
              id="report-month"
              type="month"
              name="month"
              defaultValue={month}
            />
          </div>
          <div className="field">
            <label htmlFor="tutor">Tutor</label>
            <select name="tutor_id" id="tutor" defaultValue={q.tutor_id ?? ""}>
              <option value="">All tutors</option>
              {data.memberships
                .filter((m) => m.role === "tutor")
                .map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="student">Student</label>
            <select
              name="student_id"
              id="student"
              defaultValue={q.student_id ?? ""}
            >
              <option value="">All students</option>
              {data.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                </option>
              ))}
            </select>
          </div>
          <Button>Apply filters</Button>
        </form>
      </section>
      {error ? (
        <p role="alert" className="form-message failure">
          {error}
        </p>
      ) : (
        <>
          <div className="stats-grid two">
            <Stat
              label="Tutoring hours"
              value={hours(total)}
              icon={<Clock3 size={20} />}
            />
            <Stat
              label="Students represented"
              value={new Set(rows.map((r) => r.student_id)).size}
              icon={<Users size={20} />}
            />
          </div>
          <section className="panel report-panel">
            <div className="section-heading">
              <div>
                <h2>{monthLabel(month)}</h2>
              </div>
              <div className="export-buttons">
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`/api/reports/attendance.csv?${query}&format=summary`}
                  >
                    <Download size={15} />
                    Summary CSV
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`/api/reports/attendance.csv?${query}&format=detail`}
                  >
                    Session detail CSV
                  </a>
                </Button>
              </div>
            </div>
            {rows.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student / Tutor</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Absences / Holidays</TableHead>
                    <TableHead>
                      <span className="sr-only">Open</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.assignment_id}>
                      <TableCell>
                        <strong>{r.student_name}</strong>
                        <small className="block muted">{r.tutor_name}</small>
                      </TableCell>
                      <TableCell>{r.completed_sessions}</TableCell>
                      <TableCell className="numeric">
                        {hours(r.total_minutes)}
                      </TableCell>
                      <TableCell>
                        {r.tutor_absences + r.student_absences} / {r.holidays}
                      </TableCell>

                      <TableCell>
                        <Link
                          href={`/tutor/assignments/${r.assignment_id}?month=${month}`}
                          aria-label={`Open ${r.student_name}`}
                        >
                          <ArrowUpRight size={18} />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty title="No matching assignments">
                Try another month or clear the filters.
              </Empty>
            )}
            <div className="report-total">
              <span>Total</span>
              <strong>{hours(total)} hours</strong>
            </div>
          </section>
          <section className="panel achievement-export">
            <div>
              <h2>Achievement report</h2>
              <p>
                Uses the selected month and student. Tutor filter does not
                apply.
              </p>
            </div>
            <Button asChild variant="outline">
              <a
                href={`/api/reports/achievements.csv?${new URLSearchParams({ term_id: term.id, month, student_id: q.student_id ?? "" })}`}
              >
                <Download size={16} />
                Achievements CSV
              </a>
            </Button>
          </section>
        </>
      )}
    </Shell>
  );
}
