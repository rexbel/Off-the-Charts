import { ready } from "@/db";
import { audit } from "./audit";

/**
 * Reset for the guided demo: clears runs, touchpoints and deliveries in the
 * "demo" namespace only. Real ("live") work is never touched. The EHR cohort
 * is static. Returns counts so the UI can say what was cleared.
 */
export async function resetDemo(actorId: string | null = null): Promise<{ runs: number; touchpoints: number; deliveries: number }> {
  const db = await ready();
  const runs = (await db.personaRuns.deleteMany({ namespace: "demo" })).deletedCount;
  const touchpoints = (await db.touchpoints.deleteMany({ namespace: "demo" })).deletedCount;
  const deliveries = (await db.outboxDeliveries.deleteMany({ namespace: "demo" })).deletedCount;
  await audit("demo.reset", { actorId }, { runs, touchpoints, deliveries });
  return { runs, touchpoints, deliveries };
}
