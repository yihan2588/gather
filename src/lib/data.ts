import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, configured } from "./supabase/server";
import { localDemo, demoRpc, IDS } from "./local-demo";
import type { Database, Json } from "./database.types";
import type { Workspace, Row } from "./domain";
export class AccessError extends Error {}
export async function identity() {
  if (localDemo()) {
    const id = (await cookies()).get("lvaep-demo")?.value;
    return Object.values(IDS)
      .slice(0, 4)
      .includes(id ?? "")
      ? id!
      : null;
  }
  if (!configured()) return null;
  const c = await createClient();
  const { data, error } = await c.auth.getUser();
  if (error || !data.user) return null;
  const { data: demo, error: demoError } = await c.rpc("demo_context");
  if (demoError) throw demoError;
  const review = demo as { allowed: boolean; actor_id: string | null };
  return review.allowed ? review.actor_id : data.user.id;
}
export async function call<T>(
  name: keyof Database["public"]["Functions"],
  p?: unknown,
): Promise<T> {
  if (localDemo()) {
    const uid = await identity();
    if (!uid) throw new AccessError("Sign in to continue");
    return demoRpc<T>(uid, name, p);
  }
  if (!configured()) throw new Error("Supabase is not configured");
  const c = await createClient();
  const { data, error } = await c.rpc(
    name,
    p === undefined ? {} : { p: p as Json },
  );
  if (error) throw error;
  return data as T;
}
export async function context() {
  const uid = await identity();
  if (!uid) redirect("/login");
  const data = await call<Workspace>("workspace");
  const member = data.memberships.find((x) => x.user_id === uid);
  if (!member || member.status !== "active") redirect("/pending");
  return { uid, member, data };
}
export async function staffContext() {
  const ctx = await context();
  if (ctx.member.role !== "staff") redirect("/tutor");
  return ctx;
}
export async function requireMember(): Promise<Row<"memberships">> {
  const uid = await identity();
  if (!uid) throw new AccessError("Sign in to continue");
  const d = await call<Workspace>("workspace");
  const m = d.memberships.find((x) => x.user_id === uid);
  if (!m || m.status !== "active")
    throw new AccessError("Your account is not approved");
  return m;
}
