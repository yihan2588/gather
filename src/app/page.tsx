import { context } from "@/lib/data";
import { redirect } from "next/navigation";
export default async function Home() {
  const { member } = await context();
  redirect(member.role === "staff" ? "/staff" : "/tutor");
}
