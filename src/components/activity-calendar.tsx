"use client";
import { useId, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  activityDays,
  activityLevel,
  type ActivitySession,
} from "@/lib/activity";
import { displayDate, hours, monthLabel } from "@/lib/domain";

export function ActivityCalendar({
  month,
  currentMonth,
  months,
  sessions,
  metric,
}: {
  month: string;
  currentMonth: string;
  months: string[];
  sessions: ActivitySession[];
  metric: "hours" | "sessions";
}) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();
  const [pending, startTransition] = useTransition();
  function selectMonth(value: string) {
    const params = new URLSearchParams(query.toString());
    params.set("month", value);
    startTransition(() =>
      router.replace(`${pathname}?${params}`, { scroll: false }),
    );
  }
  const days = activityDays(month, sessions);
  const [selected, setSelected] = useState<string | null>(null);
  const day = days.find((d) => d.date === selected);
  const offset = new Date(`${month}-01T12:00:00Z`).getUTCDay();
  const weeks = Math.ceil((offset + days.length) / 7);
  const labels =
    metric === "hours"
      ? ["0", "≤1", "≤2", "≤3", ">3 h"]
      : ["0", "1", "2", "3", "4+ sessions"];
  return (
    <section
      className="panel activity-calendar"
      aria-labelledby={`${id}-title`}
      aria-busy={pending}
    >
      <div className="section-heading">
        <h2 id={`${id}-title`}>Monthly activity</h2>
        <div className="activity-month">
          <label htmlFor={`${id}-month`}>Month</label>
          <select
            id={`${id}-month`}
            value={month}
            disabled={pending}
            onChange={(e) => selectMonth(e.target.value)}
          >
            {months.map((m) => (
              <option value={m} key={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={
              pending ||
              month === currentMonth ||
              !months.includes(currentMonth)
            }
            onClick={() => selectMonth(currentMonth)}
          >
            Current month
          </Button>
          {pending && <span className="muted">Loading…</span>}
        </div>
      </div>
      <div className="activity-layout">
        <div>
          <div className="activity-chart">
            <div className="activity-weekdays" aria-hidden="true">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div
              className="activity-cells"
              role="group"
              aria-label={`${monthLabel(month)} daily ${metric}`}
              style={{
                gridTemplateColumns: `repeat(${weeks}, var(--activity-cell))`,
              }}
            >
              {days.map((d, i) => (
                <button
                  key={d.date}
                  type="button"
                  className={`activity-cell intensity-${activityLevel(metric === "hours" ? d.minutes : d.sessions.length, metric)}`}
                  style={{
                    gridRow: ((offset + i) % 7) + 1,
                    gridColumn: Math.floor((offset + i) / 7) + 1,
                  }}
                  aria-label={`${displayDate(d.date)}: ${hours(d.minutes)} hours, ${d.sessions.length} sessions`}
                  aria-pressed={selected === d.date}
                  onMouseEnter={() => setSelected(d.date)}
                  onFocus={() => setSelected(d.date)}
                  onClick={() => setSelected(d.date)}
                  title={`${hours(d.minutes)} hours · ${d.sessions.length} sessions`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <div
            className="activity-legend"
            aria-label={
              metric === "hours"
                ? "Daily hours color scale"
                : "Daily session count color scale"
            }
          >
            {labels.map((label, i) => (
              <span key={label}>
                <i className={`intensity-${i}`} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>
        <div
          className="activity-day-details"
          aria-live="polite"
          aria-atomic="true"
        >
          {day ? (
            <>
              <h3>{displayDate(day.date)}</h3>
              <p>
                {hours(day.minutes)} hours · {day.sessions.length}{" "}
                {day.sessions.length === 1 ? "session" : "sessions"}
              </p>
              {day.sessions.length ? (
                <ul>
                  {day.sessions.map((s) => (
                    <li key={s.id}>
                      <span>
                        {metric === "sessions"
                          ? `${s.tutor} → ${s.student}`
                          : s.student}
                      </span>
                      <strong>{s.minutes} min</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No sessions recorded.</p>
              )}
            </>
          ) : (
            <p className="muted">
              Hover over or select a day to see{" "}
              {metric === "hours" ? "hours" : "sessions"}.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
