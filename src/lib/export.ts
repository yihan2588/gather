import "server-only";
import { call, requireMember, AccessError } from "./data";
import { reportFilter } from "./validation";
import { csv, type AttendanceReport } from "./domain";
const summaryHeaders = [
  "term_id",
  "month",
  "assignment_id",
  "tutor_id",
  "tutor_name",
  "student_id",
  "student_name",
  "completed_sessions",
  "total_minutes",
  "total_hours",
  "tutor_absences",
  "student_absences",
  "holidays",
  "site",
  "assignment_ends_on",
  "end_reason",
];
const detailHeaders = [
  "id",
  "assignment_id",
  "tutor_id",
  "tutor_name",
  "student_id",
  "student_name",
  "occurred_on",
  "kind",
  "duration_minutes",
  "created_by",
  "created_at",
  "updated_by",
  "updated_at",
  "version",
];
const achievementHeaders = [
  "id",
  "student_id",
  "student_name",
  "term_id",
  "goal_type_id",
  "category",
  "label",
  "attained_on",
  "recorded_by",
];
export async function exportReport(request: Request, achievement = false) {
  try {
    const member = await requireMember();
    if (member.role !== "staff")
      return new Response("Staff access required", { status: 403 });
    const url = new URL(request.url);
    const raw = Object.fromEntries(url.searchParams);
    const parsed = reportFilter.safeParse({ ...raw, month: `${raw.month}-01` });
    if (!parsed.success)
      return new Response("Invalid report filters", { status: 400 });
    const format = raw.format ?? "summary";
    if (!achievement && !["summary", "detail"].includes(format))
      return new Response("Unknown format", { status: 400 });
    let rows: Record<string, unknown>[];
    let headers: string[];
    if (achievement) {
      rows = await call("achievement_report", parsed.data);
      headers = achievementHeaders;
    } else {
      const r = await call<AttendanceReport>("attendance_report", parsed.data);
      rows = format === "detail" ? r.detail : r.summary;
      headers = format === "detail" ? detailHeaders : summaryHeaders;
    }
    return new Response(csv(rows, headers), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gather-${parsed.data.term_id}-${raw.month}-${achievement ? "achievements" : format}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Generated-At": new Date().toISOString(),
      },
    });
  } catch (e) {
    if (e instanceof AccessError)
      return new Response(e.message, { status: 401 });
    const error = e as { code?: string };
    if (error.code === "42501")
      return new Response("Access denied", { status: 403 });
    if (error.code === "22023")
      return new Response("Invalid reporting period", { status: 400 });
    console.error("Report export failed", { code: error.code });
    return new Response(
      "Export unavailable. Please retry; no partial report was returned.",
      { status: 500 },
    );
  }
}
