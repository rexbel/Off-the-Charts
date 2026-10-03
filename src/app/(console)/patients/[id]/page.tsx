import { notFound } from "next/navigation";
import { PatientWorkspace } from "@/components/patient/workspace";
import { getPatient, parsePatientId } from "@/lib/data/cohort";
import { getContext } from "@/lib/services/context";
import { latestRunForPatient, listRunsForPatient } from "@/lib/services/runs";
import { loadCachedRun } from "@/lib/pipeline/cached";
import { modelAvailable } from "@/lib/ai/provider";
import { buildModeSchema } from "@/lib/schemas";
import type { PatientBundle } from "@/lib/client/api";
import { currentNamespace } from "@/lib/namespace";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/patients/[id]">) {
  const { id } = await props.params;
  const pid = parsePatientId(id);
  const p = pid ? getPatient(pid) : undefined;
  return { title: p ? p.seed.displayName : "Patient" };
}

export default async function PatientPage(props: PageProps<"/patients/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const patientId = parsePatientId(id);
  const patient = patientId ? getPatient(patientId) : undefined;
  if (!patient || !patientId) notFound();

  const [ns, user] = await Promise.all([currentNamespace(), currentUser()]);
  const [{ context, edited }, latest, runs, cached] = await Promise.all([
    getContext(patient),
    latestRunForPatient(patientId, ns),
    listRunsForPatient(patientId, ns),
    loadCachedRun(patientId),
  ]);

  const bundle: PatientBundle = { patient, context, contextEdited: edited, latest, runs, cachedAvailable: cached !== null, modelAvailable: modelAvailable(), namespace: ns };
  const tab = typeof sp.tab === "string" ? sp.tab : undefined;
  const buildParam = typeof sp.build === "string" ? buildModeSchema.safeParse(sp.build) : null;
  const autoBuild = buildParam?.success ? buildParam.data : undefined;
  const openEvidence = sp.evidence === "1";

  return <PatientWorkspace key={`${patientId}-${ns}`} bundle={bundle} user={user} initialTab={tab} autoBuild={autoBuild} openEvidence={openEvidence} />;
}
