import { db, ready, schema } from "@/db";
import { audit } from "./audit";

/**
 * Reset for the guided demo: clears every stored run, touchpoint and edited
 * check-in. All data is synthetic; the EHR cohort itself is static and
 * untouched. Returns counts so the UI can say what was cleared.
 */
export async function resetAll(): Promise<{ runs: number; touchpoints: number; contexts: number }> {
  await ready();
  const runs = await db.delete(schema.personaRuns).returning({ id: schema.personaRuns.id });
  const touchpoints = await db.delete(schema.touchpoints).returning({ id: schema.touchpoints.id });
  const contexts = await db.delete(schema.patientContexts).returning({ id: schema.patientContexts.patientId });
  await audit("demo.reset", {}, { runs: runs.length, touchpoints: touchpoints.length, contexts: contexts.length });
  return { runs: runs.length, touchpoints: touchpoints.length, contexts: contexts.length };
}
