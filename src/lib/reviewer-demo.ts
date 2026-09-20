import "server-only";
import { createClient, configured } from "./supabase/server";
import { localDemo } from "./local-demo";
export type DemoContext = {
  enabled: boolean;
  allowed: boolean;
  actor_id: string | null;
};
export async function reviewerDemo(): Promise<DemoContext> {
  if (localDemo()) return { enabled: true, allowed: true, actor_id: null };
  if (!configured()) return { enabled: false, allowed: false, actor_id: null };
  const client = await createClient();
  const { data, error } = await client.rpc("demo_context");
  if (error) throw error;
  return data as DemoContext;
}
export const demoAccounts = [
  ["tutor", "Maya · Tutor", "Three students"],
  ["staff", "Sam · Staff", "People, assignments, and reports"],
  ["leo", "Leo · Tutor", "No students assigned"],
  ["pending", "Jordan · Pending approval", "Preview the approval workflow"],
] as const;
