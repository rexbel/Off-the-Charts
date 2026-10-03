import { describe, expect, it } from "vitest";
import { getPatient, listPatients } from "@/lib/data/cohort";
import { dataQualityWarnings, extractFacts, noteSections } from "./extract-facts";
import { genericBaseline } from "./generic-baseline";
import { fallbackProfile, fallbackRender, fallbackVoiceGuide, recipientsFor } from "./fallback";
import { fillDateTokens, runPipeline, scoreRun } from "./run";
import { touchpointsForRun } from "./touchpoints";
import { defaultContext } from "@/lib/services/context";
import { personaRunSchema } from "@/lib/schemas";

const FIXED_NOW = new Date("2026-10-03T12:00:00Z");

describe("cohort", () => {
  it("loads 20 synthetic patients that match the schema", () => {
    const all = listPatients();
    expect(all).toHaveLength(20);
    expect(all.every((p) => p.synthetic)).toBe(true);
  });
});

describe("extractFacts", () => {
  it("cites every fact with a field and keeps encounter ids on note facts", () => {
    const emily = getPatient(1672)!;
    const facts = extractFacts(emily);
    expect(facts.length).toBeGreaterThan(30);
    expect(new Set(facts.map((f) => f.id)).size).toBe(facts.length);
    const noteFacts = facts.filter((f) => f.field.startsWith("encounter."));
    expect(noteFacts.every((f) => typeof f.encounterId === "number" && f.date)).toBe(true);
    expect(facts.some((f) => f.field === "primary_diagnoses" && /cardiomyopathy/i.test(f.value))).toBe(true);
  });

  it("splits a note into its upper-case sections", () => {
    const enc = getPatient(1672)!.ehr.encounters[1];
    const sections = noteSections(enc.note_text);
    expect(sections["CHIEF COMPLAINT"]).toMatch(/shortness of breath/i);
    expect(sections["MEDICATIONS"]).toMatch(/Enalapril/);
  });
});

describe("dataQualityWarnings", () => {
  it("flags a male-only diagnosis on a female record", () => {
    const grace = getPatient(2861)!;
    const warnings = dataQualityWarnings(grace);
    expect(warnings.some((w) => /male breast/i.test(w) && /female/i.test(w))).toBe(true);
  });

  it("stays quiet on a consistent record", () => {
    const jake = getPatient(2544)!;
    expect(dataQualityWarnings(jake)).toEqual([]);
  });
});

describe("genericBaseline", () => {
  it("merges the chart's diagnosis into the reminder and includes legacy policy wording for substance use", () => {
    const jake = getPatient(2544)!;
    const g = genericBaseline(jake, FIXED_NOW);
    expect(g.messages).toHaveLength(3);
    expect(g.messages[1].text).toMatch(/substance abuse/i);
    expect(g.summary).toMatch(/AFTER VISIT SUMMARY/);
  });
});

describe("fallback profile", () => {
  it("routes a caregiver-primary patient to the named daughter and keeps the patient as a secondary recipient", () => {
    const walter = getPatient(2311)!;
    const ctx = defaultContext(walter);
    const recipients = recipientsFor(walter, ctx);
    expect(recipients[0]).toMatchObject({ role: "daughter", name: "Anna Kowalski", primary: true });
    expect(recipients.some((r) => r.role === "patient" && !r.primary)).toBe(true);
    const profile = fallbackProfile(walter, extractFacts(walter), ctx);
    expect(profile.cognitiveSupport.length).toBeGreaterThan(0);
    expect(profile.communicationNeeds.bestTimeOfDay).toBe("morning");
    expect(profile.communicationNeeds.readingLevel).toBe(4);
  });

  it("adds an SMS privacy rule for opioid use disorder and person-first avoid terms", () => {
    const jake = getPatient(2544)!;
    const profile = fallbackProfile(jake, extractFacts(jake), defaultContext(jake));
    const rule = profile.privacyRules.find((r) => r.channels.includes("sms"));
    expect(rule?.restrictedTerms).toContain("withdrawal");
    expect(profile.avoidTerms).toContain("drug-seeking");
  });

  it("does not treat opioids for cancer pain as a substance use disorder", () => {
    const grace = getPatient(2861)!;
    const profile = fallbackProfile(grace, extractFacts(grace), defaultContext(grace));
    expect(profile.privacyRules.some((r) => r.restrictedTerms.includes("heroin"))).toBe(false);
  });

  it("adds a guardian-scoped confidentiality rule and guardian messages for a teen with mental-health care", () => {
    const ava = getPatient(2883)!;
    const ctx = defaultContext(ava);
    const facts = extractFacts(ava);
    const profile = fallbackProfile(ava, facts, ctx);
    const rule = profile.privacyRules.find((r) => r.recipients.includes("guardian"));
    expect(rule).toBeDefined();
    const guide = fallbackVoiceGuide(profile, ava);
    const outputs = fallbackRender(ava, profile, guide, facts, ctx);
    const guardianMessages = outputs.messages.filter((m) => m.recipient === "guardian");
    expect(guardianMessages).toHaveLength(3);
    for (const m of guardianMessages) for (const term of rule!.restrictedTerms) expect(new RegExp(`\\b${term}\\b`, "i").test(m.persona)).toBe(false);
  });
});

describe("fillDateTokens", () => {
  it("replaces tokens everywhere in a nested structure", () => {
    const slot = { date: FIXED_NOW, longDate: "Monday, October 5", weekday: "Monday", time: "9:30 am", isMorning: true };
    const out = fillDateTokens({ a: "See you {{weekday}} at {{time}}", b: [{ c: "{{date}}" }] }, slot);
    expect(out).toEqual({ a: "See you Monday at 9:30 am", b: [{ c: "Monday, October 5" }] });
  });
});

describe("runPipeline (rules fallback, no model, no cache)", () => {
  it("produces a schema-valid run, scores every message, and lifts the score well above the generic template", async () => {
    const emily = getPatient(1672)!;
    const run = await runPipeline(emily, defaultContext(emily), () => {}, { mode: "cached", useCache: false, cachedStageDelayMs: 0, now: FIXED_NOW, namespace: "demo" });
    expect(personaRunSchema.safeParse(run).success).toBe(true);
    expect(run.namespace).toBe("demo");
    expect(run.stages.map((s) => s.stage)).toEqual(["extract", "profile", "voice", "render", "score"]);
    for (const m of run.scores.messages) {
      expect(m.persona.score).toBeGreaterThanOrEqual(85);
      expect(m.persona.score - m.generic.score).toBeGreaterThan(30);
    }
    expect(JSON.stringify(run.outputs)).not.toContain("{{");
    const tps = touchpointsForRun(run);
    expect(tps.map((t) => t.kind)).toEqual(["message_before_7d", "message_before_2d", "message_after_24h", "brief", "summary", "video_before", "video_after"]);
    expect(tps.every((t) => t.namespace === "demo" && t.status === "pending")).toBe(true);
  });

  it("blocks the generic template, not the Persona message, when a privacy rule applies", async () => {
    const jake = getPatient(2544)!;
    const run = await runPipeline(jake, defaultContext(jake), () => {}, { mode: "cached", useCache: false, cachedStageDelayMs: 0, now: FIXED_NOW });
    const twoDay = run.scores.messages.find((m) => m.stage === "before_2d")!;
    expect(twoDay.generic.blocked).toBe(true);
    expect(twoDay.persona.blocked).toBe(false);
    const rescored = scoreRun(run.profile, run.voiceGuide, run.outputs, run.generic);
    expect(rescored.messages[1].persona.score).toBe(twoDay.persona.score);
  });

  it("renders Spanish-stated patients in Spanish at 85 or higher on the fallback", async () => {
    for (const id of [2696, 2848]) {
      const p = getPatient(id)!;
      const run = await runPipeline(p, defaultContext(p), () => {}, { mode: "cached", useCache: false, cachedStageDelayMs: 0, now: FIXED_NOW });
      expect(run.profile.communicationNeeds.language).toBe("es");
      for (const m of run.scores.messages) expect(m.persona.score).toBeGreaterThanOrEqual(85);
      expect(run.outputs.messages[0].persona).toMatch(/^Hola /);
    }
  });

  it("keeps date tokens when asked (precompute mode)", async () => {
    const emily = getPatient(1672)!;
    const run = await runPipeline(emily, defaultContext(emily), () => {}, { mode: "cached", useCache: false, cachedStageDelayMs: 0, now: FIXED_NOW, keepDateTokens: true });
    expect(JSON.stringify(run.outputs.messages)).toContain("{{date}}");
  });
});
