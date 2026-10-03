import { desc, eq, inArray } from "drizzle-orm";
import { db, ready, schema } from "@/db";
import { outboxDeliverySchema, type Namespace, type OutboxDelivery, type Touchpoint, type User } from "@/lib/schemas";
import { newId, nowIso } from "@/lib/ids";
import { HttpError } from "@/lib/http";
import { audit } from "./audit";
import { getRun } from "./runs";
import { getTouchpoint, scoreTouchpoint } from "./touchpoints";

/**
 * Simulated sending. A delivery row is written per touchpoint; a vendor
 * adapter would replace `simulatedSend`. Privacy is re-checked at send time
 * so an edit after approval can never push a restricted term out.
 */
export type VendorAdapter = { send(input: { touchpoint: Touchpoint; channel: string }): Promise<{ vendorRef: string }> };

export const simulatedVendor: VendorAdapter = {
  async send() {
    return { vendorRef: `sim_${newId("x").slice(2, 10)}` };
  },
};

export async function sendTouchpoints(ids: string[], actor: User, namespace: Namespace, vendor: VendorAdapter = simulatedVendor): Promise<OutboxDelivery[]> {
  await ready();
  const out: OutboxDelivery[] = [];
  for (const id of ids) {
    const tp = await getTouchpoint(id);
    if (!tp) throw new HttpError(404, `Touchpoint ${id} not found`);
    if (tp.namespace !== namespace) throw new HttpError(403, "That touchpoint belongs to another workspace");
    const bundle = await getRun(tp.runId);
    if (!bundle) throw new HttpError(404, "Run not found");
    const channel = tp.kind.startsWith("message_") ? bundle.run.profile.communicationNeeds.channel : "portal";
    const base = { id: newId("dlv"), touchpointId: tp.id, patientId: tp.patientId, namespace, channel, at: nowIso() };

    let status: OutboxDelivery["status"];
    let reason: string | null = null;
    let vendorRef: string | null = null;
    if (tp.status !== "approved" && tp.status !== "edited") {
      status = "blocked";
      reason = "Not approved by a clinician.";
    } else if (tp.sentAt) {
      status = "blocked";
      reason = "Already sent.";
    } else {
      const score = scoreTouchpoint(bundle.run, tp);
      if (score.blocked) {
        status = "blocked";
        const terms = score.findings.filter((f) => f.rule === "privacy").flatMap((f) => f.matches.map((m) => m.term));
        reason = `Privacy rule violated at send time: ${[...new Set(terms)].join(", ")}.`;
      } else {
        const r = await vendor.send({ touchpoint: tp, channel });
        status = "sent_simulated";
        vendorRef = r.vendorRef;
        await db.update(schema.touchpoints).set({ sentAt: base.at }).where(eq(schema.touchpoints.id, tp.id));
      }
    }
    const row = { ...base, status, reason, vendorRef };
    await db.insert(schema.outboxDeliveries).values(row);
    await audit("outbox.send", { patientId: tp.patientId, runId: tp.runId, touchpointId: tp.id, actorId: actor.id }, { status, namespace, kind: tp.kind, channel });
    out.push(outboxDeliverySchema.parse(row));
  }
  return out;
}

export async function listDeliveries(namespace: Namespace = "live", limit = 100): Promise<OutboxDelivery[]> {
  await ready();
  const rows = await db.query.outboxDeliveries.findMany({ where: eq(schema.outboxDeliveries.namespace, namespace), orderBy: [desc(schema.outboxDeliveries.at)], limit });
  return rows.map((r) => outboxDeliverySchema.safeParse(r)).filter((p) => p.success).map((p) => p.data);
}

export async function deliveriesForTouchpoints(ids: string[]): Promise<Map<string, OutboxDelivery>> {
  await ready();
  if (!ids.length) return new Map();
  const rows = await db.query.outboxDeliveries.findMany({ where: inArray(schema.outboxDeliveries.touchpointId, ids), orderBy: [desc(schema.outboxDeliveries.at)] });
  const map = new Map<string, OutboxDelivery>();
  for (const r of rows) {
    const p = outboxDeliverySchema.safeParse(r);
    if (p.success && !map.has(p.data.touchpointId)) map.set(p.data.touchpointId, p.data);
  }
  return map;
}
