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
  // A plain 404 document: console pages stream, so a rewrite would still answer 200.
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Not found · Off the Chart</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:system-ui,sans-serif;margin:0;padding:4rem 1.5rem;color:#2b2a26;background:#fbfaf7}main{max-width:36rem;margin:0 auto}h1{font-size:1.6rem}a{color:#1d5c63}</style></head><body><main><p style="text-transform:uppercase;letter-spacing:.14em;font-size:.75rem;color:#1d5c63">Not found</p><h1>The guided demo is not enabled here.</h1><p><a href="/">Back to patients</a></p></main></body></html>`;
  return new NextResponse(html, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export const config = {
  matcher: ["/demo", "/api/demo/:path*"],
};
