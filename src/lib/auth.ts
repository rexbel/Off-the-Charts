import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { eq, lt } from "drizzle-orm";
import { db, ready, schema } from "@/db";
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

let seeded: Promise<void> | null = null;
export function ensureSeedUsers(): Promise<void> {
  if (!seeded) {
    seeded = (async () => {
      await ready();
      const password = seedPassword();
      if (!password) return;
      const existing = await db.select({ email: schema.users.email }).from(schema.users);
      const have = new Set(existing.map((u) => u.email));
      for (const u of SEED_USERS) {
        if (have.has(u.email)) continue;
        await db.insert(schema.users).values({ id: newId("usr"), email: u.email, name: u.name, role: u.role, passwordHash: hashPassword(password), createdAt: nowIso() }).onConflictDoNothing();
      }
    })().catch((err) => {
      seeded = null;
      throw err;
    });
  }
  return seeded;
}

function toUser(row: typeof schema.users.$inferSelect): User {
  return { id: row.id, email: row.email, name: row.name, role: roleSchema.parse(row.role) };
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  await ensureSeedUsers();
  const row = await db.query.users.findFirst({ where: eq(schema.users.email, email.toLowerCase().trim()) });
  if (!row || !verifyPassword(password, row.passwordHash)) return null;
  return toUser(row);
}

export async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  await ready();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  const id = randomBytes(24).toString("hex");
  await db.insert(schema.sessions).values({ id, userId, expiresAt: expiresAt.toISOString() });
  // Opportunistic cleanup of expired sessions.
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, nowIso()));
  return { id, expiresAt };
}

export async function destroySession(sessionId: string): Promise<void> {
  await ready();
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

export function sessionCookieOptions(expiresAt: Date) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt };
}

async function userForSession(sessionId: string | undefined): Promise<User | null> {
  if (!sessionId) return null;
  await ensureSeedUsers();
  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sessionId) });
  if (!session || session.expiresAt < nowIso()) return null;
  const row = await db.query.users.findFirst({ where: eq(schema.users.id, session.userId) });
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
  if (origin && req.nextUrl.origin && origin !== req.nextUrl.origin) throw new HttpError(403, "Cross-site requests are not allowed");
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
