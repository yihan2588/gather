import Link from "next/link";
import { staffContext } from "@/lib/data";
import { today } from "@/lib/domain";
import { activitySessions, monthsBetween } from "@/lib/activity";
import { ActivityCalendar } from "@/components/activity-calendar";
import { Shell, PageHeader } from "@/components/shell";
import { ArrowRight, Users, FileBarChart } from "lucide-react";
export default async function Staff({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { member, data } = await staffContext();
  const { month: requested } = await searchParams;
  const months = [
    ...new Set(
      data.terms.flatMap((t) => monthsBetween(t.starts_on, t.ends_on)),
    ),
  ].sort();
  if (!months.includes(today().slice(0, 7))) months.push(today().slice(0, 7));
  months.sort();
  const month = months.includes(requested ?? "")
    ? requested!
    : today().slice(0, 7);
  const pending = data.memberships.filter((m) => m.status === "pending").length;
  return (
    <Shell member={member} active="/staff">
      <PageHeader title="Activity summary" />
      <ActivityCalendar
        key={month}
        month={month}
        currentMonth={today().slice(0, 7)}
        months={months}
        sessions={activitySessions(data).filter((s) =>
          s.date.startsWith(month),
        )}
        metric="sessions"
      />
      <div className="staff-destinations">
        <Link href="/staff/people" className="panel destination-card">
          <Users size={22} />
          <div>
            <h2>People & assignments</h2>
            {pending > 0 && (
              <p>
                {pending} tutor{pending === 1 ? "" : "s"} awaiting approval
              </p>
            )}
          </div>
          <ArrowRight size={18} />
        </Link>
        <Link
          href={`/staff/reports?month=${month}`}
          className="panel destination-card"
        >
          <FileBarChart size={22} />
          <div>
            <h2>Monthly reports</h2>
          </div>
          <ArrowRight size={18} />
        </Link>
      </div>
    </Shell>
  );
}
