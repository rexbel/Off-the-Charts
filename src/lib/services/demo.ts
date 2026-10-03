import { eq } from "drizzle-orm";
import { db, ready, schema } from "@/db";
import { audit } from "./audit";

/**
 * Reset for the guided demo: clears runs, touchpoints and deliveries in the
 * "demo" namespace only. Real ("live") work is never touched. The EHR cohort
 * is static. Returns counts so the UI can say what was cleared.
 */
export async function resetDemo(actorId: string | null = null): Promise<{ runs: number; touchpoints: number; deliveries: number }> {
  await ready();
  const runs = await db.delete(schema.personaRuns).where(eq(schema.personaRuns.namespace, "demo")).returning({ id: schema.personaRuns.id });
  const touchpoints = await db.delete(schema.touchpoints).where(eq(schema.touchpoints.namespace, "demo")).returning({ id: schema.touchpoints.id });
  const deliveries = await db.delete(schema.outboxDeliveries).where(eq(schema.outboxDeliveries.namespace, "demo")).returning({ id: schema.outboxDeliveries.id });
  await audit("demo.reset", { actorId }, { runs: runs.length, touchpoints: touchpoints.length, deliveries: deliveries.length });
  return { runs: runs.length, touchpoints: touchpoints.length, deliveries: deliveries.length };
}
