import Link from "next/link";
import { notFound } from "next/navigation";
import { staffContext } from "@/lib/data";
import { Shell, PageHeader } from "@/components/shell";
import { ActionForm } from "@/components/action-form";
import { AchievementPanel } from "@/components/achievements";
export default async function Student({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { member, data } = await staffContext();
  const s = data.students.find((s) => s.id === id);
  if (!s) notFound();
  return (
    <Shell member={member} active="/staff/people">
      <Link className="back-link" href="/staff/people">
        ← Back to people
      </Link>
      <PageHeader title={s.display_name} />
      <section className="panel">
        <details>
          <summary>Correct student name</summary>
          <ActionForm
            operation="save_student"
            hidden={{ id }}
            fields={[
              {
                name: "display_name",
                label: "Student name",
                value: s.display_name,
                required: true,
              },
            ]}
          />
        </details>
        <h2 className="mt-6">Assignment history</h2>
        {data.assignments
          .filter((a) => a.student_id === id)
          .map((a) => (
            <Link
              key={a.id}
              className="assignment-line"
              href={`/tutor/assignments/${a.id}`}
            >
              <span>
                {
                  data.memberships.find((m) => m.user_id === a.tutor_id)
                    ?.display_name
                }{" "}
                · {data.terms.find((t) => t.id === a.term_id)?.name}
              </span>
              <span>{a.end_reason ?? "View attendance"} →</span>
            </Link>
          ))}
      </section>
      {data.terms.map((t) => (
        <div key={t.id}>
          <p className="eyebrow">{t.name}</p>
          <AchievementPanel
            member={member}
            data={data}
            studentId={id}
            termId={t.id}
          />
        </div>
      ))}
    </Shell>
  );
}
