import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { namespaceFromRequest } from "@/lib/namespace";
import { approvalQueue } from "@/lib/services/queue";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(req);
    return json({ items: await approvalQueue(namespaceFromRequest(req)) });
  });
}
