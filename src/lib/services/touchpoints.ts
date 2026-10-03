import { desc, eq, inArray } from "drizzle-orm";
import { db, ready, schema } from "@/db";
import { touchpointSchema, type PersonaRun, type TiScore, type Touchpoint, type TouchpointAction } from "@/lib/schemas";
import { scoreText } from "@/lib/ti-checker";
import { staffTarget, targetFor } from "@/lib/pipeline/run";
import { MESSAGE_KIND_TO_STAGE } from "@/lib/pipeline/touchpoints";
import { nowIso } from "@/lib/ids";
import { HttpError } from "@/lib/http";
import { audit } from "./audit";
import { getRun } from "./runs";

/** Scores a touchpoint's current text with the same rules used in the workspace. */
export function scoreTouchpoint(run: PersonaRun, tp: Touchpoint): TiScore {
  if (tp.kind === "brief") return scoreText(tp.text, staffTarget(run.profile));
  const channel = tp.kind in MESSAGE_KIND_TO_STAGE ? run.profile.communicationNeeds.channel : "portal";
  return scoreText(tp.text, targetFor(run.profile, run.voiceGuide, tp.recipient, channel));
}

export async function getTouchpoint(id: string): Promise<Touchpoint | null> {
  await ready();
  const row = await db.query.touchpoints.findFirst({ where: eq(schema.touchpoints.id, id) });
  if (!row) return null;
  const parsed = touchpointSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

/**
 * Applies approve / reject / edit / reset. Approval is refused (409) while
 * a privacy rule is violated, so a restricted term can never be approved by
 * accident. Editing re-scores; approving an edited text keeps status "edited".
 */
export async function applyTouchpointAction(id: string, action: TouchpointAction): Promise<{ touchpoint: Touchpoint; score: TiScore }> {
  const tp = await getTouchpoint(id);
  if (!tp) throw new HttpError(404, "Touchpoint not found");
  const bundle = await getRun(tp.runId);
  if (!bundle) throw new HttpError(404, "Run not found");
  const { run } = bundle;

  let next: Touchpoint = { ...tp };
  switch (action.action) {
    case "edit": {
      const text = (action.text ?? "").trim();
      if (!text) throw new HttpError(400, "Edited text cannot be empty");
      next = { ...tp, text, status: tp.status === "approved" ? "edited" : tp.status === "rejected" ? "pending" : tp.status === "edited" ? "edited" : "pending", note: action.note ?? tp.note };
      break;
    }
    case "approve": {
      const score = scoreTouchpoint(run, tp);
      if (score.blocked) {
        throw new HttpError(409, "A privacy rule is violated. Edit the text before approving.", { findings: score.findings.filter((f) => f.severity === "block" && !f.passed) });
      }
      next = { ...tp, status: tp.text !== tp.originalText ? "edited" : "approved", decidedAt: nowIso(), note: action.note ?? tp.note };
      break;
    }
    case "reject":
      next = { ...tp, status: "rejected", decidedAt: nowIso(), note: action.note ?? tp.note };
      break;
    case "reset":
      next = { ...tp, text: tp.originalText, status: "pending", decidedAt: null, note: null };
      break;
  }

  await db
    .update(schema.touchpoints)
    .set({ text: next.text, status: next.status, decidedAt: next.decidedAt, note: next.note })
    .where(eq(schema.touchpoints.id, id));
  await audit(`touchpoint.${action.action}`, { patientId: tp.patientId, runId: tp.runId, touchpointId: id }, { kind: tp.kind, status: next.status, edited: next.text !== next.originalText });
  return { touchpoint: next, score: scoreTouchpoint(run, next) };
}

export async function listApprovedTouchpoints(): Promise<Touchpoint[]> {
  await ready();
  const rows = await db.query.touchpoints.findMany({
    where: inArray(schema.touchpoints.status, ["approved", "edited"]),
    orderBy: [desc(schema.touchpoints.decidedAt)],
  });
  return rows.map((r) => touchpointSchema.safeParse(r)).filter((p) => p.success).map((p) => p.data);
}
