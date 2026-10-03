import { ready } from "@/db";
import type { Namespace, OutboxMetrics, PersonaRun, Touchpoint } from "@/lib/schemas";
import { listAllRuns } from "./runs";
import { listApprovedTouchpoints } from "./touchpoints";

/**
 * Before/after metrics measured on stored runs (latest run per patient).
 * Reading grade and TI score come from the deterministic checker; "stigma
 * terms removed" counts generic-message stigma matches that do not recur in
 * the Persona message; "privacy rules enforced" counts rules that the
 * generic text violated and the Persona text did not.
 */
export async function outboxMetrics(namespace: Namespace = "live"): Promise<OutboxMetrics> {
  const db = await ready();
  const runs = await listAllRuns(namespace);
  const latest = new Map<number, PersonaRun>();
  for (const r of runs) if (!latest.has(r.patientId)) latest.set(r.patientId, r);
  const rows = [...latest.values()];

  const latestIds = rows.map((r) => r.id);
  const tps = latestIds.length
    ? await db.touchpoints.find({ namespace, runId: { $in: latestIds } }, { projection: { _id: 0, status: 1 } }).toArray()
    : [];
  let gradeG = 0, gradeP = 0, scoreG = 0, scoreP = 0, n = 0, stigma = 0, privacy = 0;
  for (const run of rows) {
    for (const m of run.scores.messages) {
      n += 1;
      gradeG += m.generic.readingGrade;
      gradeP += m.persona.readingGrade;
      scoreG += m.generic.score;
      scoreP += m.persona.score;
      const gStigma = m.generic.findings.find((f) => f.rule === "stigma")?.matches.length ?? 0;
      const pStigma = m.persona.findings.find((f) => f.rule === "stigma")?.matches.length ?? 0;
      stigma += Math.max(0, gStigma - pStigma);
      const gPriv = m.generic.findings.find((f) => f.rule === "privacy");
      const pPriv = m.persona.findings.find((f) => f.rule === "privacy");
      if (gPriv && !gPriv.passed && pPriv?.passed) privacy += 1;
    }
  }
  const avg = (x: number) => (n ? Math.round((x / n) * 10) / 10 : 0);
  return {
    namespace,
    patientsWithRuns: rows.length,
    touchpointsTotal: tps.length,
    touchpointsApproved: tps.filter((t) => t.status === "approved" || t.status === "edited").length,
    avgReadingGradeGeneric: avg(gradeG),
    avgReadingGradePersona: avg(gradeP),
    avgTiScoreGeneric: avg(scoreG),
    avgTiScorePersona: avg(scoreP),
    stigmaTermsRemoved: stigma,
    privacyRulesEnforced: privacy,
    measuredOn: "stored runs",
  };
}

export async function outbox(namespace: Namespace = "live"): Promise<{ approved: Touchpoint[]; metrics: OutboxMetrics }> {
  const [approved, metrics] = await Promise.all([listApprovedTouchpoints(namespace), outboxMetrics(namespace)]);
  return { approved, metrics };
}
