import Link from "next/link";
import { context } from "@/lib/data";
import { today, hours, monthLabel, displayDate } from "@/lib/domain";
import { Shell, PageHeader, Stat, Empty } from "@/components/shell";
import {
  Clock3,
  Users,
  CalendarDays,
  ArrowUpRight,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
export default async function Tutor() {
  const { member, data } = await context();
  const month = today().slice(0, 7);
  const events = data.events.filter(
    (e) =>
      e.occurred_on.startsWith(month) && e.kind === "completed" && !e.voided_at,
  );
  return (
    <Shell member={member} active="/tutor">
      <PageHeader title="My students" />
      <div className="stats-grid">
        <Stat
          label="Tutoring hours"
          value={hours(events.reduce((a, e) => a + e.duration_minutes, 0))}
          note={monthLabel(month)}
          icon={<Clock3 size={20} />}
        />
        <Stat
          label="Sessions recorded"
          value={events.length}
          note={monthLabel(month)}
          icon={<CalendarDays size={20} />}
        />
        <Stat
          label="Students across terms"
          value={new Set(data.assignments.map((a) => a.student_id)).size}
          icon={<Users size={20} />}
        />
      </div>
      <div className="section-heading">
        <h2>
          My students <span>{data.assignments.length}</span>
        </h2>
      </div>
      <div className="student-grid">
        {data.assignments.map((a) => {
          const student = data.students.find((s) => s.id === a.student_id)!;
          const ended =
            (a.ends_on ?? data.terms.find((t) => t.id === a.term_id)!.ends_on) <
            today();
          return (
            <article className="student-card" key={a.id}>
              <div className="student-top">
                <span className="student-avatar">
                  {student.display_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
                <Badge variant="secondary">
                  {ended ? "Ended" : "Assigned"}
                </Badge>
              </div>
              <h3>{student.display_name}</h3>
              <p className="muted">
                {data.terms.find((t) => t.id === a.term_id)?.name}
              </p>
              <div className="student-meta">
                <span>
                  <MapPin size={15} />
                  {a.site || "Site not specified"}
                </span>
                <span>
                  <CalendarDays size={15} />
                  {a.usual_days || "Schedule not specified"}{" "}
                  {a.usual_times && `· ${a.usual_times}`}
                </span>
              </div>
              <Link
                className="student-link"
                href={`/tutor/assignments/${a.id}`}
              >
                View & record sessions <ArrowUpRight size={18} />
              </Link>
            </article>
          );
        })}
      </div>
      {!data.assignments.length && (
        <Empty title="No students assigned">
          Staff will add your student assignments here.
        </Empty>
      )}
      <section className="panel recent">
        <div className="section-heading">
          <h2>Recently recorded</h2>
        </div>
        {data.events.slice(0, 5).map((e) => {
          const a = data.assignments.find((a) => a.id === e.assignment_id);
          return (
            <Link
              className="activity-row"
              key={e.id}
              href={`/tutor/assignments/${e.assignment_id}`}
            >
              <span className="activity-icon">
                <BookIcon />
              </span>
              <div>
                <strong>
                  {
                    data.students.find((s) => s.id === a?.student_id)
                      ?.display_name
                  }
                </strong>
                <small>
                  {displayDate(e.occurred_on)}
                  {e.voided_at ? " · Voided" : ""}
                </small>
              </div>
              <span>{e.duration_minutes} min</span>
              <ArrowRight size={16} />
            </Link>
          );
        })}
        {!data.events.length && (
          <Empty title="Nothing recorded yet">
            Your saved sessions will appear here.
          </Empty>
        )}
      </section>
    </Shell>
  );
}
function BookIcon() {
  return <CalendarDays size={19} />;
}
