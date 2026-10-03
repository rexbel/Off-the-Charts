import { noId, ready } from "@/db";
import { touchpointSchema, type Namespace, type PersonaRun, type TiScore, type Touchpoint, type TouchpointAction, type User } from "@/lib/schemas";
import { scoreText } from "@/lib/ti-checker";
import { staffTarget, targetFor } from "@/lib/pipeline/run";
import { MESSAGE_KIND_TO_STAGE } from "@/lib/pipeline/touchpoints";
import { nowIso } from "@/lib/ids";
import { HttpError } from "@/lib/http";
import { audit } from "./audit";
import { getRun, markRunApproved, refreshRunApproval } from "./runs";
import { canApprove } from "@/lib/auth";
import { unconfirmedInferred } from "@/lib/pipeline/provenance";

/** Scores a touchpoint's current text with the same rules used in the workspace. */
export function scoreTouchpoint(run: PersonaRun, tp: Touchpoint): TiScore {
  if (tp.kind === "brief") return scoreText(tp.text, staffTarget(run.profile));
  const channel = tp.kind in MESSAGE_KIND_TO_STAGE ? run.profile.communicationNeeds.channel : "portal";
  return scoreText(tp.text, targetFor(run.profile, run.voiceGuide, tp.recipient, channel));
}

export async function getTouchpoint(id: string): Promise<Touchpoint | null> {
  const db = await ready();
  const row = await db.touchpoints.findOne({ id }, noId);
  if (!row) return null;
  const parsed = touchpointSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

/**
 * Applies approve / reject / edit / reset. Approval is refused (409) while
 * a privacy rule is violated, so a restricted term can never be approved by
 * accident. Editing re-scores; approving an edited text keeps status "edited".
 */
export async function applyTouchpointAction(id: string, action: TouchpointAction, actor: User | null = null, namespace: Namespace = "live"): Promise<{ touchpoint: Touchpoint; score: TiScore }> {
  const tp = await getTouchpoint(id);
  if (!tp) throw new HttpError(404, "Touchpoint not found");
  if (tp.namespace !== namespace) throw new HttpError(403, "That touchpoint belongs to another workspace");
  const bundle = await getRun(tp.runId);
  if (!bundle) throw new HttpError(404, "Run not found");
  const { run } = bundle;

  let next: Touchpoint = { ...tp };
  switch (action.action) {
    case "edit": {
      const text = (action.text ?? "").trim();
      if (!text) throw new HttpError(400, "Edited text cannot be empty");
      if (tp.sentAt) throw new HttpError(409, "This touchpoint was already sent (simulated). It cannot be edited.");
      // Any edit re-opens review: the text a clinician approved is no longer the text that would be sent.
      next = { ...tp, text, status: "pending", decidedAt: null, approvedBy: null, note: action.note ?? tp.note };
      break;
    }
    case "approve": {
      if (!canApprove(actor)) throw new HttpError(403, "Only a clinician can approve. Prepare and edit, then send it to the queue.");
      const score = scoreTouchpoint(run, tp);
      if (score.blocked) {
        throw new HttpError(409, "A privacy rule is violated. Edit the text before approving.", { findings: score.findings.filter((f) => f.severity === "block" && !f.passed) });
      }
      const pending = unconfirmedInferred(run, tp);
      if (pending.length) {
        throw new HttpError(409, `Confirm the inferred claim${pending.length === 1 ? "" : "s"} this rests on first: ${pending.map((c) => c.text).join(" · ")}`, { unconfirmed: pending });
      }
      next = { ...tp, status: tp.text !== tp.originalText ? "edited" : "approved", decidedAt: nowIso(), note: action.note ?? tp.note, approvedBy: actor?.id ?? null };
      break;
    }
    case "reject":
      next = { ...tp, status: "rejected", decidedAt: nowIso(), note: action.note ?? tp.note, approvedBy: null };
      break;
    case "reset":
      if (tp.sentAt) throw new HttpError(409, "This touchpoint was already sent (simulated). It cannot be reset.");
      next = { ...tp, text: tp.originalText, status: "pending", decidedAt: null, note: null, approvedBy: null };
      break;
  }

  const db = await ready();
  await db.touchpoints.updateOne(
    { id },
    { $set: { text: next.text, status: next.status, decidedAt: next.decidedAt, note: next.note, approvedBy: next.approvedBy, preparedBy: tp.preparedBy ?? actor?.id ?? null } },
  );
  if (action.action === "approve") await markRunApproved(tp.runId, actor?.id ?? null);
  else await refreshRunApproval(tp.runId);
  await audit(`touchpoint.${action.action}`, { patientId: tp.patientId, runId: tp.runId, touchpointId: id, actorId: actor?.id ?? null }, { kind: tp.kind, status: next.status, edited: next.text !== next.originalText, namespace: tp.namespace });
  return { touchpoint: next, score: scoreTouchpoint(run, next) };
}

export async function listApprovedTouchpoints(namespace: Namespace = "live"): Promise<Touchpoint[]> {
  const db = await ready();
  const rows = await db.touchpoints.find({ status: { $in: ["approved", "edited"] }, namespace }, noId).sort({ decidedAt: -1 }).toArray();
  return rows.map((r) => touchpointSchema.safeParse(r)).filter((p) => p.success).map((p) => p.data);
}
