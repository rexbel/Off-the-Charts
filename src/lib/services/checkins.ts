import { randomBytes } from "node:crypto";
import { noId, ready } from "@/db";
import type { PatientCheckinDoc } from "@/db/schema";
import { checkinAnswersSchema, patientCheckinSchema, type CheckinAnswers, type PatientCheckin, type PatientContext } from "@/lib/schemas";
import { getPatient } from "@/lib/data/cohort";
import { newId, nowIso } from "@/lib/ids";
import { HttpError } from "@/lib/http";
import { getContext, saveContext } from "./context";
import { audit } from "./audit";

/**
 * Patient check-in links. The token is the only credential: 32 random bytes,
 * URL-safe, valid for 14 days, single submission. Answers are patient-stated
 * and flow into the patient's context (check-in text and language) so the
 * next build treats them as the patient's own words.
 *
 * Audit events carry ids and counts only, never the answer text.
 */
export const CHECKIN_TTL_DAYS = 14;
const TOKEN_BYTES = 32;

/** 32 random bytes as base64url (43 chars, no padding). */
export function newCheckinToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Pure merge: the patient's answer replaces the check-in text and language; audience and channel stay. */
export function contextFromCheckin(existing: PatientContext, answers: CheckinAnswers): PatientContext {
  const extras: string[] = [];
  if (answers.includeWho.trim()) extras.push(`Please also include: ${answers.includeWho.trim()}.`);
  if (answers.bestTime === "morning") extras.push("Best time to reach me: morning.");
  if (answers.bestTime === "afternoon") extras.push("Best time to reach me: afternoon.");
  const checkin = [answers.whatMatters.trim(), ...extras].join(" ").slice(0, 2000);
  return { ...existing, checkin, language: answers.language };
}

/**
 * Language, who else and best time on the patient form. Off unless
 * OFF_THE_CHART_CHECKIN_EXTRA_QUESTIONS=1; when off the form sends neutral
 * defaults (current language, just me, no preference).
 */
export function checkinExtraQuestionsEnabled(): boolean {
  return process.env.OFF_THE_CHART_CHECKIN_EXTRA_QUESTIONS === "1";
}

/** Whole days left before expiry, never negative. */
export function daysUntilExpiry(expiresAt: string, now: Date = new Date()): number {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 3600 * 1000)));
}

type Row = PatientCheckinDoc;

function toCheckin(row: Row): PatientCheckin {
  let answers: CheckinAnswers | null = null;
  if (row.answers) {
    try {
      const parsed = checkinAnswersSchema.safeParse(JSON.parse(row.answers));
      answers = parsed.success ? parsed.data : null;
    } catch {
      answers = null;
    }
  }
  return patientCheckinSchema.parse({
    id: row.id,
    patientId: row.patientId,
    token: row.token,
    status: row.status,
    answers,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    submittedAt: row.submittedAt,
  });
}

export async function createCheckin(patientId: number, actorId: string | null): Promise<PatientCheckin> {
  const db = await ready();
  const now = new Date();
  const row: Row = {
    id: newId("chk"),
    patientId,
    token: newCheckinToken(),
    status: "sent",
    answers: null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CHECKIN_TTL_DAYS * 24 * 3600 * 1000).toISOString(),
    submittedAt: null,
  };
  await db.patientCheckins.insertOne({ ...row });
  await audit("checkin.created", { patientId, actorId }, { checkinId: row.id, expiresAt: row.expiresAt });
  return toCheckin(row);
}

/** Flips "sent" links past their expiry to "expired" and persists it. Scoped by patient or token. */
async function expireStale(scope: { patientId: number } | { token: string }): Promise<void> {
  const db = await ready();
  const where = "patientId" in scope ? { patientId: scope.patientId } : { token: scope.token };
  await db.patientCheckins.updateMany({ ...where, status: "sent", expiresAt: { $lt: nowIso() } }, { $set: { status: "expired" } });
}

export async function listCheckins(patientId: number): Promise<PatientCheckin[]> {
  const db = await ready();
  await expireStale({ patientId });
  const rows = await db.patientCheckins.find({ patientId }, noId).sort({ createdAt: -1 }).toArray();
  return rows.map(toCheckin);
}

export async function getCheckinByToken(token: string): Promise<PatientCheckin | null> {
  const db = await ready();
  await expireStale({ token });
  const row = await db.patientCheckins.findOne({ token }, noId);
  return row ? toCheckin(row) : null;
}

/**
 * Stores the answers once. 404 unknown token, 410 expired, 409 already
 * submitted. The update is conditional on status "sent" so two concurrent
 * submissions cannot both win; the loser gets 409.
 */
export async function submitCheckin(token: string, rawAnswers: CheckinAnswers): Promise<PatientCheckin> {
  const checkin = await getCheckinByToken(token);
  if (!checkin) throw new HttpError(404, "Check-in link not found");
  if (checkin.status === "expired") throw new HttpError(410, "This link has expired. Ask your clinic for a new one.");
  if (checkin.status === "submitted") throw new HttpError(409, "These answers were already sent.");

  const answers: CheckinAnswers = { ...rawAnswers, whatMatters: rawAnswers.whatMatters.trim(), includeWho: rawAnswers.includeWho.trim() };
  if (!answers.whatMatters) throw new HttpError(400, "Tell us what matters to you, even one line.");

  const patient = getPatient(checkin.patientId);
  if (!patient) throw new HttpError(404, "Patient not found");

  const submittedAt = nowIso();
  const db = await ready();
  const result = await db.patientCheckins.updateOne({ token, status: "sent" }, { $set: { answers: JSON.stringify(answers), status: "submitted", submittedAt } });
  if (result.modifiedCount === 0) {
    const latest = await getCheckinByToken(token);
    if (latest?.status === "expired") throw new HttpError(410, "This link has expired. Ask your clinic for a new one.");
    throw new HttpError(409, "These answers were already sent.");
  }

  const { context } = await getContext(patient);
  await saveContext(checkin.patientId, contextFromCheckin(context, answers));
  await audit(
    "checkin.submitted",
    { patientId: checkin.patientId, actorId: null },
    { checkinId: checkin.id, whatMattersChars: answers.whatMatters.length, includeWhoChars: answers.includeWho.length, language: answers.language, bestTime: answers.bestTime },
  );
  return { ...checkin, answers, status: "submitted", submittedAt };
}

/** Latest check-in per patient (status, created, submitted), for the patients work queue. */
export async function latestCheckinByPatient(): Promise<Map<number, { status: PatientCheckin["status"]; createdAt: string; submittedAt: string | null }>> {
  const db = await ready();
  const rows = await db.patientCheckins.find({}, noId).sort({ createdAt: -1 }).toArray();
  const now = nowIso();
  const out = new Map<number, { status: PatientCheckin["status"]; createdAt: string; submittedAt: string | null }>();
  for (const r of rows) {
    if (out.has(r.patientId)) continue;
    const c = toCheckin(r);
    // Expiry is computed here rather than persisted; the per-patient and token paths persist it.
    const status = c.status === "sent" && c.expiresAt < now ? "expired" : c.status;
    out.set(r.patientId, { status, createdAt: c.createdAt, submittedAt: c.submittedAt });
  }
  return out;
}
