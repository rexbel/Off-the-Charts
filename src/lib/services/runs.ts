import { noId, ready } from "@/db";
import type { PersonaRunDoc, TouchpointDoc } from "@/db/schema";
import { personaRunSchema, touchpointSchema, type Namespace, type PersonaRun, type Touchpoint } from "@/lib/schemas";
import { touchpointsForRun } from "@/lib/pipeline/touchpoints";
import { audit } from "./audit";
import { HttpError } from "@/lib/http";

function rowToRun(row: PersonaRunDoc): PersonaRun | null {
  try {
    const payload = JSON.parse(row.payload);
    const parsed = personaRunSchema.safeParse({ ...payload, id: row.id, patientId: row.patientId, createdAt: row.createdAt, source: row.source, namespace: row.namespace, approvedAt: row.approvedAt, approvedBy: row.approvedBy, confirmedClaimIds: JSON.parse(row.confirmedClaimIds) });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function rowToTouchpoint(row: TouchpointDoc): Touchpoint | null {
  const parsed = touchpointSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

/** Persists a finished run and its pending touchpoints. Idempotent on run id. */
export async function saveRun(run: PersonaRun, actorId: string | null = null): Promise<Touchpoint[]> {
  const db = await ready();
  const tps = touchpointsForRun(run).map((t) => ({ ...t, preparedBy: actorId }));
  // Touchpoints first, then the run that makes them visible; both insert-if-missing so a retry is safe.
  if (tps.length) await db.touchpoints.bulkWrite(tps.map((t) => ({ updateOne: { filter: { id: t.id }, update: { $setOnInsert: { ...t } }, upsert: true } })));
  await db.personaRuns.updateOne(
    { id: run.id },
    { $setOnInsert: { id: run.id, patientId: run.patientId, namespace: run.namespace, createdAt: run.createdAt, source: run.source, approvedAt: null, approvedBy: null, payload: JSON.stringify(run), confirmedClaimIds: JSON.stringify(run.confirmedClaimIds) } },
    { upsert: true },
  );
  await audit("run.saved", { patientId: run.patientId, runId: run.id, actorId }, { source: run.source, namespace: run.namespace, touchpoints: tps.length, stages: run.stages.map((s) => `${s.stage}:${s.source}`).join(",") });
  return tps;
}

/** Marks a run as approved (first clinician approval wins; later ones refresh the time). */
export async function markRunApproved(runId: string, actorId: string | null): Promise<void> {
  const db = await ready();
  await db.personaRuns.updateOne({ id: runId }, { $set: { approvedAt: new Date().toISOString(), approvedBy: actorId } });
}

/** Clears the marker when no approved touchpoint remains on the run. */
export async function refreshRunApproval(runId: string): Promise<void> {
  const db = await ready();
  const remaining = await db.touchpoints.findOne({ runId, status: { $in: ["approved", "edited"] } }, { projection: { _id: 0, id: 1 } });
  if (!remaining) await db.personaRuns.updateOne({ id: runId }, { $set: { approvedAt: null, approvedBy: null } });
}

export async function getRun(runId: string): Promise<{ run: PersonaRun; touchpoints: Touchpoint[] } | null> {
  const db = await ready();
  const row = await db.personaRuns.findOne({ id: runId }, noId);
  if (!row) return null;
  const run = rowToRun(row);
  if (!run) return null;
  const tps = (await db.touchpoints.find({ runId }, noId).toArray()).map(rowToTouchpoint).filter((t): t is Touchpoint => t !== null);
  return { run, touchpoints: sortTouchpoints(tps) };
}

export async function latestRunForPatient(patientId: number, namespace: Namespace = "live"): Promise<{ run: PersonaRun; touchpoints: Touchpoint[] } | null> {
  const db = await ready();
  const row = await db.personaRuns.findOne({ patientId, namespace }, { projection: { _id: 0, id: 1 }, sort: { createdAt: -1 } });
  if (!row) return null;
  return getRun(row.id);
}

export async function listRunsForPatient(patientId: number, namespace: Namespace = "live"): Promise<Pick<PersonaRun, "id" | "createdAt" | "source" | "approvedAt">[]> {
  const db = await ready();
  const rows = await db.personaRuns
    .find({ patientId, namespace }, { projection: { _id: 0, id: 1, createdAt: 1, source: 1, approvedAt: 1 } })
    .sort({ createdAt: -1 })
    .toArray();
  return rows.map((r) => ({ id: r.id, createdAt: r.createdAt, source: r.source as PersonaRun["source"], approvedAt: r.approvedAt }));
}

/** Latest run id per patient plus approval counts, for the cohort board. */
export type RunSummary = { id: string; createdAt: string; source: PersonaRun["source"]; summaryLine: string; approvedCount: number; pendingCount: number; sentCount: number; touchpointCount: number; lastActivity: string };

export async function latestRunSummaries(namespace: Namespace = "live"): Promise<Map<number, RunSummary>> {
  const db = await ready();
  const rows = await db.personaRuns
    .find({ namespace }, { projection: { _id: 0, id: 1, patientId: 1, createdAt: 1, source: 1, payload: 1 } })
    .sort({ createdAt: -1 })
    .toArray();
  const latest = new Map<number, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.patientId)) latest.set(r.patientId, r);
  const ids = [...latest.values()].map((r) => r.id);
  const tps = ids.length
    ? await db.touchpoints.find({ runId: { $in: ids } }, { projection: { _id: 0, runId: 1, status: 1, decidedAt: 1, sentAt: 1 } }).toArray()
    : [];
  const out = new Map<number, RunSummary>();
  for (const [pid, r] of latest) {
    const mine = tps.filter((t) => t.runId === r.id);
    let summaryLine = "";
    try {
      summaryLine = String((JSON.parse(r.payload) as { profile?: { summaryLine?: string } }).profile?.summaryLine ?? "");
    } catch {
      summaryLine = "";
    }
    const stamps = [r.createdAt, ...mine.map((t) => t.decidedAt ?? ""), ...mine.map((t) => t.sentAt ?? "")].filter(Boolean).sort();
    out.set(pid, {
      id: r.id,
      createdAt: r.createdAt,
      source: r.source as PersonaRun["source"],
      summaryLine,
      approvedCount: mine.filter((t) => t.status === "approved" || t.status === "edited").length,
      pendingCount: mine.filter((t) => t.status === "pending").length,
      sentCount: mine.filter((t) => t.sentAt).length,
      touchpointCount: mine.length,
      lastActivity: stamps[stamps.length - 1] ?? r.createdAt,
    });
  }
  return out;
}

export async function confirmClaim(runId: string, claimId: string, actorId: string | null = null, namespace: Namespace = "live"): Promise<string[] | null> {
  const db = await ready();
  const row = await db.personaRuns.findOne({ id: runId }, noId);
  if (!row) return null;
  if (row.namespace !== namespace) throw new HttpError(403, "That run belongs to another workspace");
  const run = rowToRun(row);
  const known = run ? new Set([...run.profile.emotionalContext, ...run.profile.cognitiveSupport, ...run.profile.strengths, ...run.profile.privacyRules].map((c) => c.id)) : new Set<string>();
  if (!known.has(claimId)) throw new HttpError(404, "That claim is not part of this run");
  const ids = new Set<string>(JSON.parse(row.confirmedClaimIds) as string[]);
  ids.add(claimId);
  const next = [...ids];
  await db.personaRuns.updateOne({ id: runId }, { $set: { confirmedClaimIds: JSON.stringify(next) } });
  await audit("claim.confirmed", { patientId: row.patientId, runId, actorId }, { claimId });
  return next;
}

const KIND_ORDER = ["message_before_7d", "message_before_2d", "message_after_24h", "brief", "summary", "video_before", "video_after"];
export function sortTouchpoints(tps: Touchpoint[]): Touchpoint[] {
  return [...tps].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

export async function listAllRuns(namespace: Namespace = "live"): Promise<PersonaRun[]> {
  const db = await ready();
  const rows = await db.personaRuns.find({ namespace }, noId).sort({ createdAt: -1 }).toArray();
  return rows.map(rowToRun).filter((r): r is PersonaRun => r !== null);
}
