import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { parsePatientId } from "@/lib/data/cohort";
import { recentAudit } from "@/lib/services/audit";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(req);
    const raw = req.nextUrl.searchParams.get("patientId");
    const patientId = raw ? (parsePatientId(raw) ?? undefined) : undefined;
    const limit = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 100) || 100));
    return json({ events: await recentAudit({ patientId, limit }) });
  });
}
