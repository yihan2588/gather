import { describe, expect, it } from "vitest";
import {
  activityDays,
  activityLevel,
  monthsBetween,
} from "../../src/lib/activity";
describe("monthly activity", () => {
  it("includes every calendar day, aggregates same-day minutes, and excludes other months", () => {
    const days = activityDays("2024-02", [
      {
        id: "1",
        date: "2024-02-29",
        minutes: 60,
        tutor: "Maya",
        student: "Ana",
      },
      {
        id: "2",
        date: "2024-02-29",
        minutes: 90,
        tutor: "Maya",
        student: "Ben",
      },
      {
        id: "3",
        date: "2024-03-01",
        minutes: 20,
        tutor: "Maya",
        student: "Ana",
      },
    ]);
    expect(days).toHaveLength(29);
    expect(days[0]).toMatchObject({
      date: "2024-02-01",
      minutes: 0,
      sessions: [],
    });
    expect(days[28].minutes).toBe(150);
    expect(days[28].sessions).toHaveLength(2);
    expect(activityDays("2026-02", [])).toHaveLength(28);
  });
  it("uses stable intensity thresholds for hours versus session counts", () => {
    expect(
      [0, 30, 60, 90, 120, 180, 181].map((n) => activityLevel(n, "hours")),
    ).toEqual([0, 1, 1, 2, 2, 3, 4]);
    expect([0, 1, 2, 3, 4, 9].map((n) => activityLevel(n, "sessions"))).toEqual(
      [0, 1, 2, 3, 4, 4],
    );
  });
  it("lists months across the year boundary inclusively", () => {
    expect(monthsBetween("2026-11-15", "2027-02-01")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });
});
