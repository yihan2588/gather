import { QuickTour } from "@/components/quick-tour";
import Link from "next/link";
import { reviewerDemo } from "@/lib/reviewer-demo";
import { identity, call } from "@/lib/data";
import { redirect } from "next/navigation";
import type { Workspace } from "@/lib/domain";
import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Clock3 } from "lucide-react";
export default async function Pending() {
  const uid = await identity();
  if (!uid) redirect("/login");
  const demo = await reviewerDemo();
  const data = await call<Workspace>("workspace");
  const member = data.memberships.find((x) => x.user_id === uid);
  if (member?.status === "active") redirect("/");
  return (
    <main id="main" className="standalone">
      <Clock3 size={36} />
      <QuickTour demo={demo.allowed} />
      <h1>
        {member?.status === "disabled"
          ? "Your access is paused."
          : "Awaiting approval"}
      </h1>
      <p>
        {member?.status === "disabled"
          ? "Please contact your program staff about restoring access."
          : "Your account is waiting for program staff approval. Student records will appear here once you’re approved and assigned."}
      </p>
      {demo.allowed && (
        <Link href="/demo" className="back-link">
          Switch demo account
        </Link>
      )}
      <form action={signOut}>
        <Button variant="outline">Sign out</Button>
      </form>
    </main>
  );
}
