"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

type Step = { target: string; title: string; text: string };
const step = (target: string, title: string, text: string): Step => ({
  target,
  title,
  text,
});
const seenThisVisit = new Set<string>();

function pageTour(
  path: string,
  demo: boolean,
  local: boolean,
): { id: string; steps: Step[] } {
  const switchAccount = step(
    '[data-tour="switch"]',
    "Try another role",
    "Switch demo account lets you explore the same fictional records as a tutor or staff member.",
  );
  if (path === "/login")
    return {
      id: demo ? "demo-login" : "login",
      steps: [
        step(
          local ? ".demo-options" : ".google-button",
          local
            ? "Explore the local preview"
            : demo
              ? "Explore with your Google account"
              : "Sign in with Google",
          local
            ? "Choose an example account below to explore the local preview. For this demo, continue with any Google account to try all roles. In actual use, Google OAuth verifies your identity; program staff approve access, and roles and assignments determine which records each person can see."
            : demo
              ? "For this demo, continue with any Google account to explore all tutor and staff workflows. In actual use, Google OAuth verifies your identity; program staff approve access, and your role and assignments determine which records you can see."
              : "Google verifies your identity. Program staff then approve your access and assign your role. Tutors see their assigned students; staff manage the program.",
        ),
      ],
    };
  if (path === "/demo")
    return {
      id: "accounts",
      steps: [
        step(
          '[data-tour="persona-tutor"]',
          "Start as a tutor",
          "Choose Maya to record sessions and achievements for three students. You can switch accounts from inside the workspace at any time.",
        ),
        step(
          '[data-tour="persona-staff"]',
          "Explore program management",
          "Choose Sam to manage tutors and assignments, review activity, and download monthly reports. Leo shows an unassigned tutor; Jordan previews waiting for approval. These are shared fictional accounts, separate from your Google identity.",
        ),
      ],
    };
  if (path === "/tutor")
    return {
      id: "tutor",
      steps: [
        step(
          ".student-card h3, .empty",
          "Your students",
          "Open View & record sessions on a student card to enter tutoring time and achievements. If no students are assigned, program staff need to create an assignment first.",
        ),
        step(
          ".stats-grid",
          "Your monthly totals",
          "Hours and session counts update from saved sessions for the current month. Open a student to review another month or correct an entry.",
        ),
        ...(demo ? [switchAccount] : []),
      ],
    };
  if (path.startsWith("/tutor/assignments/"))
    return {
      id: "sessions",
      steps: [
        step(
          '[data-tour="record-session"]',
          "Record tutoring time",
          "Enter the session date and duration in minutes, then Save session. Record tutoring time only, excluding homework. Saving adds the session to the monthly report.",
        ),
        step(
          ".assignment-month-filter",
          "Review and correct",
          "Choose a month to update the totals and session history. Current month returns to this month. In Session history, use Edit entry for corrections or Void entry to remove a mistaken entry from totals.",
        ),
        step(
          '[data-tour="achievements"]',
          "Record progress",
          "Use Record an achievement to add a goal and the date it was attained. Achievements appear in a separate staff report.",
        ),
      ],
    };
  if (path === "/staff")
    return {
      id: "staff",
      steps: [
        step(
          ".activity-chart",
          "Activity across all tutors",
          "Darker days have more completed sessions. Hover, focus, or tap a day to see tutor–student pairs and durations. Use the month selector or Current month to change the period.",
        ),
        step(
          ".staff-destinations",
          "Two places to manage the program",
          "People & assignments is where you approve tutors and assign students. Monthly reports collects attendance and achievements for export.",
        ),
        ...(demo ? [switchAccount] : []),
      ],
    };
  if (path === "/staff/people")
    return {
      id: "people",
      steps: [
        step(
          '[data-tour="tutors"]',
          "Manage tutor access",
          "Approve access lets a tutor use the workspace. Pause access blocks their access without deleting records. Assign a student next so an approved tutor can record sessions.",
        ),
        step(
          '[data-tour="assign"]',
          "Connect a tutor and student",
          "Add a student if needed, then choose the student, tutor, and term under Assign a tutor. Existing assignments appear in the directory below.",
        ),
      ],
    };
  if (path === "/staff/reports")
    return {
      id: "reports",
      steps: [
        step(
          ".report-filters",
          "Choose the reporting period",
          "Select the program year and month. Optionally narrow by tutor or student, then Apply filters to update the report.",
        ),
        step(
          ".export-buttons",
          "Download attendance",
          "Download the monthly summary or individual session details as CSV files. The exports use your current filters.",
        ),
        step(
          ".achievement-export",
          "Download achievements",
          "Download student goals attained in the selected program year and month, optionally filtered by student. The tutor filter does not apply to achievements.",
        ),
      ],
    };
  if (path === "/pending")
    return {
      id: "pending",
      steps: [
        step(
          ".standalone h1",
          "Waiting for access",
          demo
            ? "This example shows what an unapproved tutor sees in actual use. To keep exploring now, use Switch demo account and choose Maya or Sam."
            : "Program staff must approve your account and assign students before their records appear. Contact your program staff if you need help.",
        ),
      ],
    };
  return { id: "", steps: [] };
}

export function QuickTour({
  demo = false,
  local = false,
}: {
  demo?: boolean;
  local?: boolean;
}) {
  const path = usePathname();
  const tour = pageTour(path, demo, local);
  // A new page gets a fresh dialog; changing a month does not restart its tour.
  return tour.steps.length ? (
    <Tour key={tour.id} id={tour.id} steps={tour.steps} />
  ) : null;
}

function Tour({ id, steps }: { id: string; steps: Step[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const highlight = useRef<HTMLDivElement>(null);
  const pointer = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const key = `gather:tour:v1:${id}`;
  const current = index === null ? null : steps[index];

  useEffect(() => {
    let seen = seenThisVisit.has(key);
    try {
      seen ||= localStorage.getItem(key) === "done";
    } catch {
      /* Storage may be unavailable. */
    }
    if (seen) return;
    const timer = setTimeout(() => setIndex(0), 350);
    return () => clearTimeout(timer);
  }, [key]);

  useEffect(() => {
    if (!current || !dialog.current || !bubble.current) return;
    const modal = dialog.current;
    const card = bubble.current;
    const ring = highlight.current!;
    // On short phone screens, point at one representative control rather than
    // outlining a whole panel that cannot fit above the explanation.
    const compactTargets: Record<string, string> = {
      ".activity-chart": '.activity-cell[aria-pressed="true"], .activity-cell',
      ".staff-destinations": ".staff-destinations h2",
      ".stats-grid": ".stats-grid .stat",
      ".report-filters": "#report-month",
      ".achievement-export": ".achievement-export h2",
      '[data-tour="persona-tutor"]': '[data-tour="persona-tutor"] h2',
      '[data-tour="persona-staff"]': '[data-tour="persona-staff"] h2',
      ".demo-options": ".demo-options button",
    };
    const findTarget = () =>
      document.querySelector<HTMLElement>(
        window.innerWidth < 600 && window.innerHeight < 700
          ? (compactTargets[current.target] ?? current.target)
          : current.target,
      );
    let target = findTarget();
    const originalScroll = window.scrollY;
    modal.showModal();
    function revealTarget() {
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const width = window.innerWidth;
      const height = window.innerHeight;
      const visible = rect.top >= 12 && rect.bottom <= height - 12;
      const fitsBeside =
        rect.right + card.offsetWidth + 28 < width ||
        rect.left > card.offsetWidth + 28;
      const fitsVertically =
        rect.bottom + card.offsetHeight + 28 < height ||
        rect.top > card.offsetHeight + 28;
      // Keep visible content stationary. Only reveal an offscreen target, or
      // make room on small screens where the bubble would cover its control.
      if (visible && (fitsBeside || fitsVertically || width >= 600)) return;
      if (width < 600) document.body.classList.add("tour-active");
      const delta =
        !visible && fitsBeside
          ? rect.top < 12
            ? rect.top - 12
            : rect.bottom - height + 12
          : rect.top - 90;
      window.scrollTo({
        top: Math.max(0, window.scrollY + delta),
        behavior: "instant",
      });
    }
    revealTarget();
    const position = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const resizedTarget = findTarget();
      if (resizedTarget !== target) {
        target = resizedTarget;
        revealTarget();
      }
      const rect = target?.getBoundingClientRect();
      const w = card.offsetWidth;
      const h = card.offsetHeight;
      let left = (width - w) / 2;
      let top = (height - h) / 2;
      let side = "none";
      if (rect) {
        Object.assign(ring.style, {
          display: "block",
          left: `${Math.max(4, rect.left - 5)}px`,
          top: `${Math.max(4, rect.top - 5)}px`,
          width: `${Math.min(rect.width + 10, width - 8)}px`,
          height: `${Math.min(rect.height + 10, height - Math.max(4, rect.top - 5) - 4)}px`,
        });
        if (rect.right + w + 28 < width) {
          left = rect.right + 20;
          top = rect.top;
          side = "left";
        } else if (rect.left > w + 28) {
          left = rect.left - w - 20;
          top = rect.top;
          side = "right";
        } else if (rect.bottom + h + 28 < height) {
          left = rect.left;
          top = rect.bottom + 20;
          side = "top";
        } else if (rect.top > h + 28) {
          left = rect.left;
          top = rect.top - h - 20;
          side = "bottom";
        } else {
          top = height - h - 12;
        }
      } else {
        ring.style.display = "none";
      }
      left = Math.max(12, Math.min(left, width - w - 12));
      top = Math.max(12, Math.min(top, height - h - 12));
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
      const arrow = pointer.current!;
      arrow.style.display = side === "none" ? "none" : "block";
      arrow.dataset.side = side;
      const vertical = side === "top" || side === "bottom";
      const x = vertical
        ? Math.max(
            left + 20,
            Math.min((rect?.left ?? 0) + (rect?.width ?? 0) / 2, left + w - 20),
          )
        : side === "left"
          ? left
          : left + w;
      const y = vertical
        ? side === "top"
          ? top
          : top + h
        : Math.max(
            top + 20,
            Math.min((rect?.top ?? 0) + (rect?.height ?? 0) / 2, top + h - 20),
          );
      arrow.style.left = `${x - 6}px`;
      arrow.style.top = `${y - 6}px`;
    };
    position();
    heading.current?.focus({ preventScroll: true });
    const observer = new ResizeObserver(position);
    observer.observe(card);
    if (target) observer.observe(target);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      modal.close();
      document.body.classList.remove("tour-active");
      window.scrollTo({ top: originalScroll, behavior: "instant" });
    };
  }, [current]);

  function finish() {
    seenThisVisit.add(key);
    try {
      localStorage.setItem(key, "done");
    } catch {
      /* Keep working without persistent storage. */
    }
    dialog.current?.close();
    setIndex(null);
    launcher.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <button
        ref={launcher}
        type="button"
        className="tour-launcher"
        onClick={() => setIndex(0)}
      >
        Quick tour
      </button>
      <dialog
        ref={dialog}
        className="tour-dialog"
        aria-labelledby={`tour-title-${id}`}
        aria-describedby={`tour-copy-${id}`}
        onCancel={(event) => {
          event.preventDefault();
          finish();
        }}
      >
        <div ref={highlight} className="tour-highlight" aria-hidden="true" />
        <div ref={bubble} className="tour-bubble">
          <div className="tour-progress">
            <span>
              Quick tour · {index === null ? 1 : index + 1} of {steps.length}
            </span>
            <button type="button" onClick={finish}>
              Skip tour
            </button>
          </div>
          <h2 ref={heading} tabIndex={-1} id={`tour-title-${id}`}>
            {current?.title}
          </h2>
          <p id={`tour-copy-${id}`}>{current?.text}</p>
          <div className="tour-controls">
            <Button
              variant="outline"
              disabled={index === 0}
              onClick={() => setIndex((n) => Math.max(0, (n ?? 0) - 1))}
            >
              Back
            </Button>
            <Button
              onClick={() =>
                index === steps.length - 1
                  ? finish()
                  : setIndex((n) => (n ?? 0) + 1)
              }
            >
              {index === steps.length - 1 ? "Got it" : "Next"}
            </Button>
          </div>
        </div>
        <div ref={pointer} className="tour-pointer" aria-hidden="true" />
      </dialog>
    </>
  );
}
