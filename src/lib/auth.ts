import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { noId, ready } from "@/db";
import type { UserDoc } from "@/db/schema";
import { roleSchema, type Role, type User } from "@/lib/schemas";
import { newId, nowIso } from "@/lib/ids";
import { HttpError } from "@/lib/http";

/**
 * Cookie sessions with seeded staff accounts. No self-signup. Passwords are
 * scrypt-hashed with a per-user salt. Sessions live in the database and
 * expire after 7 days.
 */
export const SESSION_COOKIE = "otc_session";
const SESSION_DAYS = 7;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** Seeded accounts for a clinic. The password comes from SEED_PASSWORD (default outside production only). */
export const SEED_USERS: { email: string; name: string; role: Role }[] = [
  { email: "coordinator@clinic.test", name: "Jordan Reyes", role: "coordinator" },
  { email: "clinician@clinic.test", name: "Dr. Maya Chen", role: "clinician" },
  { email: "admin@clinic.test", name: "Sam Okafor", role: "admin" },
];

export function seedPassword(): string | null {
  if (process.env.SEED_PASSWORD) return process.env.SEED_PASSWORD;
  return process.env.NODE_ENV === "production" ? null : "offthechart";
}

/**
 * One-click sign-in for a public demo (OFF_THE_CHART_QUICK_SIGNIN=1). Coordinator and clinician only:
 * the admin account always needs the password, and no password is ever sent to the browser.
 */
export const QUICK_SIGNIN_ROLES: Role[] = ["coordinator", "clinician"];

export function quickSigninEnabled(): boolean {
  return process.env.OFF_THE_CHART_QUICK_SIGNIN === "1";
}

export async function quickSigninUser(email: string): Promise<User | null> {
  if (!quickSigninEnabled()) return null;
  const seed = SEED_USERS.find((u) => u.email === email.toLowerCase().trim());
  if (!seed || !QUICK_SIGNIN_ROLES.includes(seed.role)) return null;
  await ensureSeedUsers();
  const db = await ready();
  const row = await db.users.findOne({ email: seed.email }, noId);
  return row && QUICK_SIGNIN_ROLES.includes(roleSchema.parse(row.role)) ? toUser(row) : null;
}

let seeded: Promise<void> | null = null;
export function ensureSeedUsers(): Promise<void> {
  if (!seeded) {
    seeded = (async () => {
      const db = await ready();
      const password = seedPassword();
      if (!password) return;
      for (const u of SEED_USERS) {
        // Insert-if-missing keyed on email, so concurrent first requests can't duplicate an account.
        await db.users.updateOne({ email: u.email }, { $setOnInsert: { id: newId("usr"), email: u.email, name: u.name, role: u.role, passwordHash: hashPassword(password), createdAt: nowIso() } }, { upsert: true });
      }
    })().catch((err) => {
      seeded = null;
      throw err;
    });
  }
  return seeded;
}

function toUser(row: UserDoc): User {
  return { id: row.id, email: row.email, name: row.name, role: roleSchema.parse(row.role) };
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  await ensureSeedUsers();
  const db = await ready();
  const row = await db.users.findOne({ email: email.toLowerCase().trim() }, noId);
  if (!row || !verifyPassword(password, row.passwordHash)) return null;
  return toUser(row);
}

export async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const db = await ready();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  const id = randomBytes(24).toString("hex");
  await db.sessions.insertOne({ id, userId, expiresAt: expiresAt.toISOString() });
  // Opportunistic cleanup of expired sessions.
  await db.sessions.deleteMany({ expiresAt: { $lt: nowIso() } });
  return { id, expiresAt };
}

export async function destroySession(sessionId: string): Promise<void> {
  const db = await ready();
  await db.sessions.deleteOne({ id: sessionId });
}

export function sessionCookieOptions(expiresAt: Date) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt };
}

async function userForSession(sessionId: string | undefined): Promise<User | null> {
  if (!sessionId) return null;
  await ensureSeedUsers();
  const db = await ready();
  const session = await db.sessions.findOne({ id: sessionId }, noId);
  if (!session || session.expiresAt < nowIso()) return null;
  const row = await db.users.findOne({ id: session.userId }, noId);
  return row ? toUser(row) : null;
}

/** Current user in a server component or page. */
export async function currentUser(): Promise<User | null> {
  const store = await cookies();
  return userForSession(store.get(SESSION_COOKIE)?.value);
}

/** Current user in a route handler. */
export async function userFromRequest(req: NextRequest): Promise<User | null> {
  assertSameSite(req);
  return userForSession(req.cookies.get(SESSION_COOKIE)?.value);
}

/** Rejects state-changing requests that a browser marks as cross-site (CSRF defense in depth beyond SameSite=Lax). */
export function assertSameSite(req: NextRequest): void {
  if (req.method === "GET" || req.method === "HEAD") return;
  const site = req.headers.get("sec-fetch-site");
  if (site === "cross-site") throw new HttpError(403, "Cross-site requests are not allowed");
  const origin = req.headers.get("origin");
  if (!origin) return;
  // Compare hosts, not req.nextUrl.origin: behind a proxy (Cloudflare tunnel, the otc-edge Worker)
  // the standalone server builds nextUrl from its own listen address and plain http.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Cross-site requests are not allowed");
  }
  if (originHost !== host) throw new HttpError(403, "Cross-site requests are not allowed");
}

/** Route guard: 401 when signed out, 403 when the role is not allowed. */
export async function requireUser(req: NextRequest, roles?: Role[]): Promise<User> {
  assertSameSite(req);
  const user = await userFromRequest(req);
  if (!user) throw new HttpError(401, "Sign in to continue");
  if (roles && !roles.includes(user.role) && user.role !== "admin") throw new HttpError(403, `This action needs a ${roles.map((r) => r).join(" or ")}`);
  return user;
}

export const canApprove = (user: User | null): boolean => user?.role === "clinician" || user?.role === "admin";
