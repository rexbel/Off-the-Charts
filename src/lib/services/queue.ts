import { noId, ready } from "@/db";
import { touchpointSchema, type Namespace, type QueueItem, type Touchpoint } from "@/lib/schemas";
import { listPatients } from "@/lib/data/cohort";
import { getRun } from "./runs";
import { scoreTouchpoint } from "./touchpoints";

/**
 * Cross-patient approval queue: every pending touchpoint on the latest run
 * per patient, with its current score so a clinician can see blocked items.
 */
export async function approvalQueue(namespace: Namespace = "live"): Promise<QueueItem[]> {
  const db = await ready();
  const rows = await db.touchpoints.find({ status: "pending", namespace }, noId).sort({ patientId: 1 }).toArray();
  const tps = rows.map((r) => touchpointSchema.safeParse(r)).filter((p) => p.success).map((p) => p.data as Touchpoint);
  if (tps.length === 0) return [];
  // Only the latest run per patient counts (across all runs, not just those with pending items).
  const patientIds = [...new Set(tps.map((t) => t.patientId))];
  const latest = await db.personaRuns
    .find({ patientId: { $in: patientIds }, namespace }, { projection: { _id: 0, id: 1, patientId: 1, createdAt: 1, source: 1 } })
    .toArray();
  const latestByPatient = new Map<number, (typeof latest)[number]>();
  for (const r of latest) {
    const cur = latestByPatient.get(r.patientId);
    if (!cur || cur.createdAt < r.createdAt) latestByPatient.set(r.patientId, r);
  }
  const names = new Map(listPatients().map((p) => [p.patientId, p.seed.displayName]));
  const items: QueueItem[] = [];
  const runCache = new Map<string, Awaited<ReturnType<typeof getRun>>>();
  for (const tp of tps) {
    const run = latestByPatient.get(tp.patientId);
    if (!run || run.id !== tp.runId) continue;
    if (!runCache.has(tp.runId)) runCache.set(tp.runId, await getRun(tp.runId));
    const bundle = runCache.get(tp.runId);
    if (!bundle) continue;
    const score = scoreTouchpoint(bundle.run, tp);
    items.push({ touchpoint: tp, patientName: names.get(tp.patientId) ?? `Patient ${tp.patientId}`, runSource: bundle.run.source, runCreatedAt: bundle.run.createdAt, blocked: score.blocked, score: score.score });
  }
  return items;
}
