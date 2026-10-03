import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { namespaceFromRequest } from "@/lib/namespace";
import { patientSummaries } from "@/lib/services/patients";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(req);
    return json({ patients: await patientSummaries(namespaceFromRequest(req)) });
  });
}
