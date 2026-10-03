import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { namespaceFromRequest } from "@/lib/namespace";
import { outbox } from "@/lib/services/outbox";
import { deliveriesForTouchpoints } from "@/lib/services/deliveries";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(req);
    const ns = namespaceFromRequest(req);
    const data = await outbox(ns);
    const deliveries = await deliveriesForTouchpoints(data.approved.map((t) => t.id));
    return json({ ...data, deliveries: Object.fromEntries(deliveries) });
  });
}
