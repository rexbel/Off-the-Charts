import type { PersonaRun, RenderedOutputs, Touchpoint, TouchpointKind, VisitSummary } from "@/lib/schemas";
import { newId } from "@/lib/ids";
import { primaryRecipient } from "./fallback";

/** Flattens a visit summary to plain text for approval, editing and printing. */
export function summaryToText(s: VisitSummary): string {
  return [
    s.headline,
    "",
    "What we talked about",
    ...s.whatWeTalkedAbout.map((i) => `• ${i.text}`),
    "",
    "Your next steps",
    ...s.yourNextSteps.map((i, n) => `${n + 1}. ${i}`),
    "",
    "When to call",
    ...s.whenToCall.map((i) => `• ${i}`),
    "",
    "Questions for next time",
    ...s.questionsForNextTime.map((i) => `• ${i}`),
  ].join("\n");
}

export function videoToText(outputs: RenderedOutputs, stage: "before" | "after"): string {
  const v = outputs.videoScripts.find((s) => s.stage === stage);
  if (!v) return "";
  return [v.title, "", ...v.scenes.map((s, i) => `${i + 1}. ${s.title ? `${s.title}: ` : ""}${s.voiceover}`)].join("\n");
}

/** One approvable touchpoint per rendered output. */
export function touchpointsForRun(run: PersonaRun): Touchpoint[] {
  const primary = primaryRecipient(run.profile.recipients).role;
  const make = (kind: TouchpointKind, recipient: string, text: string): Touchpoint => ({
    id: newId("tp"),
    runId: run.id,
    patientId: run.patientId,
    kind,
    recipient,
    status: "pending",
    text,
    originalText: text,
    decidedAt: null,
    note: null,
  });
  const byStage = (stage: "before_7d" | "before_2d" | "after_24h") => run.outputs.messages.find((m) => m.stage === stage);
  const m7 = byStage("before_7d");
  const m2 = byStage("before_2d");
  const m24 = byStage("after_24h");
  return [
    make("message_before_7d", m7?.recipient ?? primary, m7?.persona ?? ""),
    make("message_before_2d", m2?.recipient ?? primary, m2?.persona ?? ""),
    make("message_after_24h", m24?.recipient ?? primary, m24?.persona ?? ""),
    make("brief", "clinician", run.outputs.clinicianBrief.lines.join("\n")),
    make("summary", primary, summaryToText(run.outputs.visitSummary)),
    make("video_before", primary, videoToText(run.outputs, "before")),
    make("video_after", primary, videoToText(run.outputs, "after")),
  ];
}

export const MESSAGE_KIND_TO_STAGE = {
  message_before_7d: "before_7d",
  message_before_2d: "before_2d",
  message_after_24h: "after_24h",
} as const;
