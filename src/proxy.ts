import { NextResponse, type NextRequest } from "next/server";

/**
 * When the guided demo is disabled (OFF_THE_CHART_DEMO=0, or production
 * without an explicit opt-in), /demo and the demo API do not exist. Done here
 * so the response is a real 404 even though console pages stream.
 */
function demoEnabled(): boolean {
  const flag = process.env.OFF_THE_CHART_DEMO;
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function proxy(req: NextRequest) {
  if (demoEnabled()) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "The demo is not enabled in this environment" }, { status: 404 });
  // Rewrite to a route that does not exist so the app's not-found page renders with a 404 status.
  return NextResponse.rewrite(new URL("/__demo-disabled", req.url), { status: 404 });
}

export const config = {
  matcher: ["/demo", "/api/demo/:path*"],
};
