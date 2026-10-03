import { noId, ready } from "@/db";
import { outboxDeliverySchema, type Namespace, type OutboxDelivery, type Touchpoint, type User } from "@/lib/schemas";
import { newId, nowIso } from "@/lib/ids";
import { HttpError } from "@/lib/http";
import { audit } from "./audit";
import { getRun } from "./runs";
import { getTouchpoint, scoreTouchpoint } from "./touchpoints";
import { isPostVisitKind, visitDateForRun } from "@/lib/pipeline/provenance";
import { getPatient } from "@/lib/data/cohort";

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
  const db = await ready();
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
    } else if (isPostVisitKind(tp.kind) && visitDateForRun(bundle.run, getPatient(tp.patientId)?.seed.upcomingVisit.daysUntil ?? 0) > new Date()) {
      status = "blocked";
      reason = "The visit has not happened yet. After-visit messages and summaries are pre-visit drafts; re-render or edit after the visit, then send.";
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
        await db.touchpoints.updateOne({ id: tp.id }, { $set: { sentAt: base.at } });
      }
    }
    const row = { ...base, status, reason, vendorRef };
    await db.outboxDeliveries.insertOne({ ...row });
    await audit("outbox.send", { patientId: tp.patientId, runId: tp.runId, touchpointId: tp.id, actorId: actor.id }, { status, namespace, kind: tp.kind, channel });
    out.push(outboxDeliverySchema.parse(row));
  }
  return out;
}

export async function listDeliveries(namespace: Namespace = "live", limit = 100): Promise<OutboxDelivery[]> {
  const db = await ready();
  const rows = await db.outboxDeliveries.find({ namespace }, noId).sort({ at: -1 }).limit(limit).toArray();
  return rows.map((r) => outboxDeliverySchema.safeParse(r)).filter((p) => p.success).map((p) => p.data);
}

export async function deliveriesForTouchpoints(ids: string[]): Promise<Map<string, OutboxDelivery>> {
  if (!ids.length) return new Map();
  const db = await ready();
  const rows = await db.outboxDeliveries.find({ touchpointId: { $in: ids } }, noId).sort({ at: -1 }).toArray();
  const map = new Map<string, OutboxDelivery>();
  for (const r of rows) {
    const p = outboxDeliverySchema.safeParse(r);
    if (p.success && !map.has(p.data.touchpointId)) map.set(p.data.touchpointId, p.data);
  }
  return map;
}
