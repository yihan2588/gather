"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, configured } from "@/lib/supabase/server";
import { localDemo, IDS } from "@/lib/local-demo";
import { call, requireMember, AccessError } from "@/lib/data";
import { schemas, type Operation } from "@/lib/validation";
export type ActionResult = {
  ok: boolean;
  message: string;
  errors?: Record<string, string[]>;
};
export async function mutate(
  operation: Operation,
  raw: unknown,
): Promise<ActionResult> {
  if (!Object.hasOwn(schemas, operation))
    return { ok: false, message: "Unknown operation" };
  const parsed = schemas[operation].safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const e of parsed.error.issues) {
      const key = String(e.path[0] ?? "form");
      (errors[key] ??= []).push(e.message);
    }
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      errors,
    };
  }
  try {
    await requireMember();
    await call(operation, parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved successfully." };
  } catch (error) {
    if (error instanceof AccessError)
      return { ok: false, message: error.message };
    const e = error as { code?: string; message?: string };
    if (["22023", "40001", "42501"].includes(e.code ?? ""))
      return { ok: false, message: e.message ?? "Unable to save." };
    if (e.code === "23505")
      return { ok: false, message: "This record already exists." };
    if (
      ["23514", "23502", "23503", "22P02", "22007", "22008"].includes(
        e.code ?? "",
      )
    )
      return {
        ok: false,
        message: "Please check the required fields and dates.",
      };
    const id = crypto.randomUUID();
    console.error("Mutation failed", { id, operation, code: e.code });
    return {
      ok: false,
      message: `Unable to save. Your entries are retained. Reference: ${id}`,
    };
  }
}
export async function signIn() {
  if (!configured()) redirect("/login?error=setup");
  const origin = process.env.APP_URL;
  if (!origin) redirect("/login?error=setup");
  const c = await createClient();
  const { data, error } = await c.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}
export async function signOut() {
  if (localDemo()) (await cookies()).delete("lvaep-demo");
  else if (configured()) {
    const c = await createClient();
    await c.auth.signOut();
  }
  redirect("/login");
}
export async function demoSignIn(form: FormData) {
  if (!localDemo()) throw new Error("Local demonstration disabled");
  const role = String(form.get("persona"));
  const uid =
    role === "staff"
      ? IDS.sam
      : role === "pending"
        ? IDS.pending
        : role === "leo"
          ? IDS.leo
          : IDS.maya;
  (await cookies()).set("lvaep-demo", uid, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect(
    role === "staff" ? "/staff" : role === "pending" ? "/pending" : "/tutor",
  );
}
