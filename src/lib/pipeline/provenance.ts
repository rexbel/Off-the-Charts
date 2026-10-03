import type { Fact, PersonaProfile, PersonaRun, RenderedOutputs, Touchpoint, TouchpointKind } from "@/lib/schemas";

/**
 * Deterministic provenance checks applied after every profile and render
 * stage, model or cached. The model proposes; code verifies:
 *   - a "fact" claim must cite at least one real fact id, else it is
 *     downgraded to "inferred" with a reason;
 *   - claim ids that do not exist in the profile are stripped from outputs.
 */
export function validateProfile(profile: PersonaProfile, facts: Fact[]): { profile: PersonaProfile; warnings: string[] } {
  const known = new Set(facts.map((f) => f.id));
  const warnings: string[] = [];
  const fix = <T extends { id: string; kind: PersonaProfile["emotionalContext"][number]["kind"]; source: { factIds: string[]; note?: string }; reason?: string }>(c: T, what: string): T => {
    const factIds = c.source.factIds.filter((id) => known.has(id));
    if (factIds.length !== c.source.factIds.length) warnings.push(`${what} ${c.id} cited unknown fact ids; they were removed.`);
    if (c.kind === "fact" && factIds.length === 0) {
      warnings.push(`${what} ${c.id} was labeled a fact without a cited fact; downgraded to inferred.`);
      return { ...c, kind: "inferred", source: { ...c.source, factIds }, reason: c.reason ?? "No chart fact was cited for this statement." };
    }
    return { ...c, source: { ...c.source, factIds } };
  };
  return {
    profile: {
      ...profile,
      emotionalContext: profile.emotionalContext.map((c) => fix(c, "Claim")),
      cognitiveSupport: profile.cognitiveSupport.map((c) => fix(c, "Claim")),
      strengths: profile.strengths.map((c) => fix(c, "Claim")),
      privacyRules: profile.privacyRules.map((r) => fix(r, "Privacy rule")),
    },
    warnings,
  };
}

export function knownClaimIds(profile: PersonaProfile): Set<string> {
  return new Set([...profile.emotionalContext, ...profile.cognitiveSupport, ...profile.strengths, ...profile.privacyRules].map((c) => c.id));
}

export function validateOutputs(outputs: RenderedOutputs, profile: PersonaProfile): { outputs: RenderedOutputs; warnings: string[] } {
  const known = knownClaimIds(profile);
  let stripped = 0;
  const keep = (ids: string[]) => {
    const ok = ids.filter((id) => known.has(id));
    stripped += ids.length - ok.length;
    return [...new Set(ok)];
  };
  const out: RenderedOutputs = {
    ...outputs,
    messages: outputs.messages.map((m) => ({ ...m, claimIds: keep(m.claimIds) })),
    clinicianBrief: { ...outputs.clinicianBrief, claimIds: keep(outputs.clinicianBrief.claimIds) },
    visitSummary: { ...outputs.visitSummary, whatWeTalkedAbout: outputs.visitSummary.whatWeTalkedAbout.map((i) => ({ ...i, claimIds: keep(i.claimIds) })) },
  };
  return { outputs: out, warnings: stripped ? [`${stripped} claim reference(s) pointed at no known claim and were removed.`] : [] };
}

const STAGE_OF_KIND = { message_before_7d: "before_7d", message_before_2d: "before_2d", message_after_24h: "after_24h" } as const;

/** Claims a touchpoint rests on, so approval can require confirming the inferred ones. */
export function claimIdsForTouchpoint(run: PersonaRun, tp: Touchpoint): string[] {
  if (tp.kind in STAGE_OF_KIND) {
    const stage = STAGE_OF_KIND[tp.kind as keyof typeof STAGE_OF_KIND];
    const m = run.outputs.messages.find((x) => x.stage === stage && x.recipient === tp.recipient) ?? run.outputs.messages.find((x) => x.stage === stage);
    return m?.claimIds ?? [];
  }
  if (tp.kind === "brief") return run.outputs.clinicianBrief.claimIds;
  if (tp.kind === "summary") return run.outputs.visitSummary.whatWeTalkedAbout.flatMap((i) => i.claimIds);
  return [];
}

/** Inferred claims this touchpoint relies on that nobody has confirmed yet. */
export function unconfirmedInferred(run: PersonaRun, tp: Touchpoint): { id: string; text: string }[] {
  const confirmed = new Set(run.confirmedClaimIds);
  const all = [...run.profile.emotionalContext, ...run.profile.cognitiveSupport, ...run.profile.strengths].map((c) => ({ id: c.id, kind: c.kind, text: c.text }));
  const rules = run.profile.privacyRules.map((r) => ({ id: r.id, kind: r.kind, text: r.rule }));
  const byId = new Map([...all, ...rules].map((c) => [c.id, c]));
  return [...new Set(claimIdsForTouchpoint(run, tp))]
    .map((id) => byId.get(id))
    .filter((c): c is { id: string; kind: "inferred"; text: string } => Boolean(c && c.kind === "inferred" && !confirmed.has(c.id)))
    .map((c) => ({ id: c.id, text: c.text }));
}

/** Outputs written for after the visit: approvable as drafts, not sendable until the visit has happened. */
export const POST_VISIT_KINDS: TouchpointKind[] = ["message_after_24h", "summary", "video_after"];

export function isPostVisitKind(kind: TouchpointKind): boolean {
  return POST_VISIT_KINDS.includes(kind);
}

/** The visit date implied by the run: created-at plus the seed's days-until, at local midnight. */
export function visitDateForRun(run: PersonaRun, daysUntil: number): Date {
  const d = new Date(run.createdAt);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysUntil);
  return d;
}
