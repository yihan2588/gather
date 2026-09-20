import type { Workspace, Row } from "@/lib/domain";
import { today, displayDate } from "@/lib/domain";
import { ActionForm } from "./action-form";
import { Award } from "lucide-react";
export function AchievementPanel({
  data,
  member,
  studentId,
  termId,
}: {
  data: Workspace;
  member: Row<"memberships">;
  studentId: string;
  termId: string;
}) {
  const current =
    member.role === "staff" ||
    data.assignments.some(
      (a) =>
        a.student_id === studentId &&
        a.tutor_id === member.user_id &&
        a.starts_on <= today() &&
        (a.ends_on ?? data.terms.find((t) => t.id === a.term_id)!.ends_on) >=
          today(),
    );
  const items = data.achievements.filter(
    (x) => x.student_id === studentId && x.term_id === termId,
  );
  const goals = [
    { value: "", label: "Other achievement" },
    ...data.goals.map((g) => ({
      value: g.id,
      label: `${g.category} · ${g.source_asterisk ? "*" : ""}${g.label}`,
    })),
  ];
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>
          <Award size={21} /> Student achievements
        </h2>
      </div>
      {!current ? (
        <p className="muted">
          Achievement access is available to currently assigned tutors and
          staff.
        </p>
      ) : (
        <>
          {items
            .filter((x) => !x.voided_at)
            .map((x) => (
              <div className="achievement" key={x.id}>
                <div>
                  <strong>
                    {data.goals.find((g) => g.id === x.goal_type_id)?.label ??
                      x.custom_label}
                  </strong>
                  <small>{displayDate(x.attained_on)}</small>
                </div>
                {(member.role === "staff" ||
                  x.recorded_by === member.user_id) && (
                  <details>
                    <summary>Correct / void</summary>
                    <ActionForm
                      operation="save_achievement"
                      hidden={{ id: x.id, expected_version: x.version }}
                      label="Save achievement correction"
                      fields={[
                        {
                          name: "goal_type_id",
                          label: "Goal",
                          options: goals,
                          value: x.goal_type_id ?? "",
                        },
                        {
                          name: "custom_label",
                          label: "Other label (only for Other)",
                          value: x.custom_label ?? "",
                        },
                        {
                          name: "attained_on",
                          label: "Date attained",
                          type: "date",
                          value: x.attained_on,
                          max: today(),
                          required: true,
                        },
                      ]}
                    />
                    <ActionForm
                      operation="save_achievement"
                      hidden={{ id: x.id, expected_version: x.version }}
                      label="Void achievement"
                      danger
                      fields={[
                        {
                          name: "void_reason",
                          label: "Reason",
                          required: true,
                        },
                      ]}
                    />
                  </details>
                )}
              </div>
            ))}
          <details className="add-achievement">
            <summary>+ Record an achievement</summary>
            <ActionForm
              operation="save_achievement"
              hidden={{ student_id: studentId, term_id: termId }}
              reset
              label="Save achievement"
              fields={[
                {
                  name: "goal_type_id",
                  label: "Goal attained",
                  options: goals,
                  value: "",
                },
                {
                  name: "custom_label",
                  label: "Other achievement (leave blank for a named goal)",
                },
                {
                  name: "attained_on",
                  label: "Date attained",
                  type: "date",
                  value: today(),
                  max: today(),
                  required: true,
                },
              ]}
            />
          </details>
        </>
      )}
    </section>
  );
}
