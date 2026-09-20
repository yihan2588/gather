import type { Workspace } from "./domain";
export type ActivitySession = {
  id: string;
  date: string;
  minutes: number;
  tutor: string;
  student: string;
};
export function monthsBetween(start: string, end: string) {
  const months: string[] = [];
  const cursor = new Date(`${start.slice(0, 7)}-01T12:00:00Z`);
  while (cursor.toISOString().slice(0, 7) <= end.slice(0, 7)) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}
export function activityDays(month: string, sessions: ActivitySession[]) {
  const [year, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const grouped = new Map<string, ActivitySession[]>();
  for (const s of sessions) {
    const group = grouped.get(s.date) ?? [];
    group.push(s);
    grouped.set(s.date, group);
  }
  return Array.from({ length: count }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const entries = grouped.get(date) ?? [];
    return {
      date,
      sessions: entries,
      minutes: entries.reduce((sum, s) => sum + s.minutes, 0),
    };
  });
}
export function activityLevel(value: number, metric: "hours" | "sessions") {
  return value === 0
    ? 0
    : Math.min(4, Math.ceil(value / (metric === "hours" ? 60 : 1)));
}
export function activitySessions(
  data: Workspace,
  assignmentId?: string,
): ActivitySession[] {
  const assignments = new Map(data.assignments.map((a) => [a.id, a]));
  const students = new Map(data.students.map((s) => [s.id, s.display_name]));
  const tutors = new Map(
    data.memberships.map((m) => [m.user_id, m.display_name]),
  );
  return data.events
    .filter(
      (e) =>
        !e.voided_at &&
        e.kind === "completed" &&
        (!assignmentId || e.assignment_id === assignmentId),
    )
    .map((e) => {
      const a = assignments.get(e.assignment_id)!;
      return {
        id: e.id,
        date: e.occurred_on,
        minutes: e.duration_minutes,
        tutor: tutors.get(a.tutor_id) ?? "Tutor",
        student: students.get(a.student_id) ?? "Student",
      };
    });
}
