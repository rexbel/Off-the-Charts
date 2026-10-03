import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { namespaceSchema, type Namespace } from "@/lib/schemas";

/**
 * Which data namespace a request is working in. The guided demo sets the
 * `otc_ns=demo` cookie so its runs, touchpoints, deliveries and metrics
 * never mix with real work. Everything else is "live".
 */
export const NAMESPACE_COOKIE = "otc_ns";

export function parseNamespace(raw: string | undefined | null): Namespace {
  if (!demoEnabled()) return "live";
  const parsed = namespaceSchema.safeParse(raw);
  return parsed.success ? parsed.data : "live";
}

export function namespaceFromRequest(req: NextRequest): Namespace {
  return parseNamespace(req.cookies.get(NAMESPACE_COOKIE)?.value);
}

/** For server components and route handlers without a request object. */
export async function currentNamespace(): Promise<Namespace> {
  const store = await cookies();
  return parseNamespace(store.get(NAMESPACE_COOKIE)?.value);
}

export function demoEnabled(): boolean {
  // On by default outside production; production must opt in.
  const flag = process.env.OFF_THE_CHART_DEMO;
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}
