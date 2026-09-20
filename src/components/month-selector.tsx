"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { monthLabel } from "@/lib/domain";

export function MonthSelector({
  month,
  months,
  currentMonth,
}: {
  month: string;
  months: string[];
  currentMonth: string;
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
  const currentAvailable = months.includes(currentMonth);
  return (
    <div className="assignment-month-filter" aria-busy={pending}>
      <label htmlFor={id}>Month</label>
      <select
        id={id}
        value={month}
        disabled={pending}
        onChange={(event) => selectMonth(event.target.value)}
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || month === currentMonth || !currentAvailable}
        title={
          !currentAvailable
            ? "The current month is outside this program year"
            : undefined
        }
        onClick={() => selectMonth(currentMonth)}
      >
        Current month
      </Button>
      {pending && <span className="muted">Updating…</span>}
    </div>
  );
}
