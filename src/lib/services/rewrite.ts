import type { PatientRecord, RewriteRequest, RewriteResponse, RunSource } from "@/lib/schemas";
import { scoreText, stigmaMatches } from "@/lib/ti-checker";
import { ModelError, completeText } from "@/lib/ai/provider";
import { rewriteSystem } from "@/lib/ai/prompts";
import { extractFacts } from "@/lib/pipeline/extract-facts";
import { fallbackProfile, fallbackVoiceGuide, primaryRecipient, scrubForPrivacy } from "@/lib/pipeline/fallback";
import { targetFor } from "@/lib/pipeline/run";
import { getContext } from "./context";
import { latestRunForPatient } from "./runs";
import { audit } from "./audit";

/**
 * "Paste your clinic's message": rewrites any generic message for one person
 * using their latest profile and voice guide (or the rules-based profile when
 * no run exists yet), then scores before and after with the same checker.
 */
export async function rewriteMessage(record: PatientRecord, req: RewriteRequest): Promise<RewriteResponse> {
  const latest = await latestRunForPatient(record.patientId);
  const { context } = await getContext(record);
  const facts = latest?.run.facts ?? extractFacts(record);
  const profile = latest?.run.profile ?? fallbackProfile(record, facts, context);
  const guide = latest?.run.voiceGuide ?? fallbackVoiceGuide(profile, record);
  const primary = primaryRecipient(profile.recipients);
  const target = targetFor(profile, guide, primary.role, profile.communicationNeeds.channel);
  const before = scoreText(req.text, target);

  let rewritten: string;
  let source: RunSource;
  try {
    const r = await completeText({
      system: rewriteSystem(),
      user: [`PersonaProfile:\n${JSON.stringify(profile)}`, `VoiceGuide:\n${JSON.stringify(guide)}`, `Original message (stage ${req.stage}):\n${req.text}`].join("\n\n"),
    });
    rewritten = r.text;
    source = "live";
  } catch (err) {
    rewritten = fallbackRewrite(req.text, profile, guide);
    source = "fallback";
    if (!(err instanceof ModelError)) console.error("[rewrite] unexpected", err instanceof Error ? err.message : err);
  }
  const after = scoreText(rewritten, target);
  await audit("rewrite", { patientId: record.patientId }, { source, before: before.score, after: after.score });
  return {
    source,
    original: req.text,
    rewritten,
    before,
    after,
    claimIds: [...profile.emotionalContext, ...profile.cognitiveSupport].map((c) => c.id).slice(0, 4),
  };
}

/** Rules-only rewrite: swap stigma terms, scrub privacy, wrap in the voice guide. */
export function fallbackRewrite(text: string, profile: ReturnType<typeof fallbackProfile>, guide: ReturnType<typeof fallbackVoiceGuide>): string {
  const lang = profile.communicationNeeds.language;
  const primary = primaryRecipient(profile.recipients);
  let body = text.replace(/\s+/g, " ").trim();
  // Replace stigma terms with their suggested alternatives, right to left so indexes stay valid.
  const matches = stigmaMatches(body, lang).sort((a, b) => b.index - a.index);
  for (const m of matches) {
    if (!m.suggestion) continue;
    body = body.slice(0, m.index) + m.suggestion + body.slice(m.index + m.length);
  }
  body = scrubForPrivacy(body, profile.privacyRules, profile.communicationNeeds.channel, primary.role, lang);
  // Drop threatening boilerplate.
  body = body
    .replace(/Patients? who (fail|are non-compliant|do not)[^.]*\./gi, "")
    .replace(/(Do not reply[^.]*\.|this inbox is not monitored\.?)/gi, "")
    .replace(/Reply C to confirm or X to cancel\.?/gi, lang === "es" ? "Responda SÍ para confirmar, o díganos si prefiere otra hora." : "Reply YES to confirm, or tell us if another time works better.")
    .replace(/\s{2,}/g, " ")
    .trim();
  const choice = guide.choicePhrases[0] ? (lang === "es" ? "Puede traer a alguien si quiere." : "You can bring someone if you'd like.") : "";
  const safety = guide.safetyPhrases[0] ?? "";
  const together = lang === "es" ? "Decidimos juntos los próximos pasos." : "We'll go over the plan together.";
  return `${guide.greeting} ${body} ${choice} ${together} ${safety}\n${guide.signoff}`.replace(/ +/g, " ").trim();
}
