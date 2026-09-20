import { exportReport } from "@/lib/export";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return exportReport(request, true);
}
