import { cookies } from "next/headers";
import { reviewerDemo } from "@/lib/reviewer-demo";
import { localDemo } from "@/lib/local-demo";
import { context } from "@/lib/data";
import { redirect } from "next/navigation";
export default async function Home() {
  const { member } = await context();
  if (
    !localDemo() &&
    (await reviewerDemo()).allowed &&
    !(await cookies()).has("gather-persona")
  )
    redirect("/demo");
  redirect(member.role === "staff" ? "/staff" : "/tutor");
}
