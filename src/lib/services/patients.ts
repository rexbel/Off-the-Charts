import { listPatients, getPatient } from "@/lib/data/cohort";
import type { Namespace, PatientSummary } from "@/lib/schemas";
import { latestRunSummaries } from "./runs";

export async function patientSummaries(namespace: Namespace = "live"): Promise<PatientSummary[]> {
  const runs = await latestRunSummaries(namespace);
  return listPatients().map((p) => ({
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
    latestRun: runs.get(p.patientId) ?? null,
  }));
}

export { getPatient, listPatients };
