import { describe, it, expect } from "vitest";
import { csv, hours, safeReturnPath } from "../../src/lib/domain";
import { calendarDate, createAttendance } from "../../src/lib/validation";
describe("input and presentation rules", () => {
  it("uses exact minutes and rounds only hours for display", () => {
    expect(hours(135)).toBe("2.25");
    expect(hours(61)).toBe("1.02");
  });
  it("accepts valid leap dates and rejects normalized impossible dates", () => {
    expect(calendarDate.safeParse("2028-02-29").success).toBe(true);
    expect(calendarDate.safeParse("2026-02-29").success).toBe(false);
  });
  it("rejects fractions and zero completed sessions", () => {
    for (const mins of [1.5, 0, -2])
      expect(
        createAttendance.safeParse({
          assignment_id: crypto.randomUUID(),
          request_id: crypto.randomUUID(),
          occurred_on: "2026-08-01",
          kind: "completed",
          duration_minutes: mins,
        }).success,
      ).toBe(false);
  });
  it("quotes CSV text and neutralizes spreadsheet formulas", () => {
    const out = csv(
      [
        { name: '  =HYPERLINK("x")', minutes: 90 },
        { name: "A, B\nC", minutes: 0 },
      ],
      ["name", "minutes"],
    );
    expect(out).toContain('"\'  =HYPERLINK(""x"")",90');
    expect(out).toContain('"A, B\nC",0');
  });
  it("does not allow OAuth open redirects", () => {
    for (const p of [
      "//evil.test",
      "/\\evil.test",
      "/%2f%2fevil.test",
      "https://evil.test",
    ])
      expect(safeReturnPath(p)).toBe("/");
    expect(safeReturnPath("/tutor")).toBe("/tutor");
  });
});
