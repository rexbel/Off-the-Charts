import { listPatients, getPatient } from "@/lib/data/cohort";
import type { Namespace, PatientSummary } from "@/lib/schemas";
import { latestRunSummaries } from "./runs";
import { latestCheckinByPatient } from "./checkins";

export async function patientSummaries(namespace: Namespace = "live"): Promise<PatientSummary[]> {
  const [runs, checkins] = await Promise.all([latestRunSummaries(namespace), namespace === "live" ? latestCheckinByPatient() : Promise.resolve(new Map())]);
  return listPatients().map((p) => {
    const run = runs.get(p.patientId) ?? null;
    const checkin = checkins.get(p.patientId) ?? null;
    const stamps = [run?.lastActivity, checkin?.submittedAt ?? checkin?.createdAt].filter((x): x is string => Boolean(x)).sort();
    return {
      patientId: p.patientId,
      displayName: p.seed.displayName,
      preferredName: p.seed.preferredName,
      age: p.ehr.age,
      sex: p.ehr.sex,
      ageBand: p.seed.ageBand,
      audience: p.seed.audience,
      caregiver: p.seed.caregiver,
      personaArchetype: p.seed.personaArchetype,
      primaryDiagnoses: p.ehr.primary_diagnoses,
      upcomingVisit: p.seed.upcomingVisit,
      language: p.seed.statedLanguage,
      dementia: p.seed.dementia,
      demoRole: p.seed.demoRole,
      encounterCount: p.ehr.encounters.length,
      latestRun: run
        ? { id: run.id, createdAt: run.createdAt, source: run.source, summaryLine: run.summaryLine, approvedCount: run.approvedCount, pendingCount: run.pendingCount, sentCount: run.sentCount, touchpointCount: run.touchpointCount }
        : null,
      checkin,
      updatedAt: stamps[stamps.length - 1] ?? null,
    };
  });
}

export { getPatient, listPatients };
