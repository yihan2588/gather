"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mutate, type ActionResult } from "@/app/actions";
import type { Operation } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
export type Field = {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: string | number;
  max?: string | number;
  hint?: string;
};
export function ActionForm({
  operation,
  fields = [],
  hidden = {},
  label = "Save",
  reset = false,
  danger = false,
  duplicates = [],
}: {
  operation: Operation;
  fields?: Field[];
  hidden?: Record<string, unknown>;
  label?: string;
  reset?: boolean;
  danger?: boolean;
  duplicates?: {
    occurred_on: string;
    duration_minutes: number;
    kind: string;
  }[];
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const request = useRef<{ payload: string; id: string } | null>(null);
  const router = useRouter();
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const raw: Record<string, unknown> = {
      ...hidden,
      ...Object.fromEntries(new FormData(form).entries()),
    };
    if (operation === "create_attendance") {
      const same = duplicates.some(
        (e) =>
          e.occurred_on === raw.occurred_on &&
          e.kind === raw.kind &&
          e.duration_minutes === Number(raw.duration_minutes),
      );
      if (same && !duplicate) {
        setDuplicate(true);
        setResult({
          ok: false,
          message:
            "A matching session already exists. Check the history below. Submit again only if this is a separate session.",
        });
        return;
      }
      const payload = JSON.stringify(raw);
      if (request.current?.payload !== payload)
        request.current = { payload, id: crypto.randomUUID() };
      raw.request_id = request.current.id;
    }
    setResult(null);
    start(async () => {
      try {
        const answer = await mutate(operation, raw);
        setResult(answer);
        if (answer.ok) {
          request.current = null;
          setDuplicate(false);
          if (reset) form.reset();
          router.refresh();
        }
      } catch {
        setResult({
          ok: false,
          message:
            "The connection was interrupted. Your entries are retained. Retry to check whether this save completed.",
        });
      }
    });
  }
  return (
    <form onSubmit={submit} className="action-form">
      <div className="form-grid">
        {fields.map((f) => (
          <div
            key={f.name}
            className={f.type === "textarea" ? "field wide" : "field"}
          >
            <Label
              htmlFor={`${operation}-${String(hidden.id ?? hidden.assignment_id ?? "new")}-${f.name}`}
            >
              {f.label}
              {f.required ? <span aria-hidden="true"> *</span> : null}
            </Label>
            {f.options ? (
              <select
                id={`${operation}-${String(hidden.id ?? hidden.assignment_id ?? "new")}-${f.name}`}
                name={f.name}
                defaultValue={f.value ?? ""}
                required={f.required}
                aria-invalid={!!result?.errors?.[f.name]}
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <Textarea
                id={`${operation}-${String(hidden.id ?? hidden.assignment_id ?? "new")}-${f.name}`}
                name={f.name}
                defaultValue={f.value ?? ""}
                required={f.required}
                maxLength={Number(f.max ?? 300)}
              />
            ) : (
              <Input
                id={`${operation}-${String(hidden.id ?? hidden.assignment_id ?? "new")}-${f.name}`}
                name={f.name}
                type={f.type ?? "text"}
                defaultValue={f.value ?? ""}
                required={f.required}
                min={f.min}
                max={f.max}
                step={f.type === "number" ? 1 : undefined}
                aria-invalid={!!result?.errors?.[f.name]}
              />
            )}{" "}
            {f.hint && <small>{f.hint}</small>}
            {result?.errors?.[f.name]?.map((e) => (
              <p className="field-error" key={e}>
                {e}
              </p>
            ))}
          </div>
        ))}
      </div>
      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={`form-message ${result.ok ? "success" : "failure"}`}
        >
          {result.message}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        variant={danger ? "destructive" : "default"}
      >
        {pending ? "Saving…" : duplicate ? "Save separate session" : label}
      </Button>
    </form>
  );
}
