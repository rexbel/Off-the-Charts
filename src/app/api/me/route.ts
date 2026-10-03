import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/http";
import { userFromRequest } from "@/lib/auth";
import { namespaceFromRequest, demoEnabled } from "@/lib/namespace";

export async function GET(req: NextRequest) {
  return handle(async () => json({ user: await userFromRequest(req), namespace: namespaceFromRequest(req), demoEnabled: demoEnabled() }));
}
