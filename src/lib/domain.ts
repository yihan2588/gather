import type { Database } from "./database.types";
export type Row<K extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][K]["Row"];
export type Workspace = {
  memberships: Row<"memberships">[];
  terms: Row<"terms">[];
  students: Row<"students">[];
  assignments: Row<"assignments">[];
  events: Row<"attendance_events">[];
  goals: Row<"goal_types">[];
  achievements: Row<"student_achievements">[];
};
export type ReportRow = {
  term_id: string;
  month: string;
  assignment_id: string;
  tutor_id: string;
  tutor_name: string;
  student_id: string;
  student_name: string;
  completed_sessions: number;
  total_minutes: number;
  total_hours: number;
  tutor_absences: number;
  student_absences: number;
  holidays: number;
  site: string;
  assignment_ends_on: string | null;
  end_reason: string | null;
};
export type AttendanceReport = {
  summary: ReportRow[];
  detail: Record<string, string | number | null>[];
  generated_at: string;
};
export const kindLabel: Record<string, string> = {
  completed: "Tutoring session",
  student_absent: "Student absent",
  tutor_absent: "Tutor absent",
  holiday: "Holiday",
};
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function hours(minutes: number) {
  return (minutes / 60).toFixed(2);
}
export function displayDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month.slice(0, 7)}-01T12:00:00Z`));
}
export function csv(rows: Record<string, unknown>[], headers: string[]) {
  const cell = (v: unknown) => {
    if (v == null) return "";
    if (typeof v === "number") return String(v);
    let s = String(v);
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      headers.map(cell).join(","),
      ...rows.map((r) => headers.map((h) => cell(r[h])).join(",")),
    ].join("\r\n") +
    "\r\n"
  );
}
export function safeReturnPath(value: string | null) {
  return value &&
    /^\/(?!\/)/.test(value) &&
    !/[\\\u0000-\u001f]/.test(value) &&
    !/%(?:2f|5c|0[ad])/i.test(value)
    ? value
    : "/";
}
