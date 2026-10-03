import type { Encounter, Fact, PatientRecord } from "@/lib/schemas";

/**
 * Stage 1: deterministic extraction. Turns the EHR record into a flat list of
 * cited facts the model is allowed to reason over. No LLM here, so every
 * claim downstream can point back to a field and encounter.
 */

const SECTION_RE = /^([A-Z][A-Z \/&-]{3,}):\s*$/m;

/** Splits an encounter note into its upper-case sections. */
export function noteSections(note: string): Record<string, string> {
  const lines = note.split("\n");
  const out: Record<string, string> = {};
  let current: string | null = null;
  for (const line of lines) {
    const m = line.match(SECTION_RE);
    if (m) {
      current = m[1];
      out[current] = "";
      continue;
    }
    if (current) out[current] += (out[current] ? "\n" : "") + line;
  }
  for (const k of Object.keys(out)) out[k] = out[k].trim();
  return out;
}

function firstSentences(text: string, n: number): string {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .filter(Boolean);
  return sentences.slice(0, n).join(" ").trim();
}

export function extractFacts(record: PatientRecord): Fact[] {
  const facts: Fact[] = [];
  let n = 0;
  const add = (field: string, value: string, enc?: Encounter) => {
    const v = value.trim();
    if (!v) return;
    n += 1;
    facts.push({
      id: `f${n}`,
      field,
      value: v,
      encounterId: enc?.encounter_id,
      date: enc?.encounter_date,
    });
  };

  const { ehr, seed } = record;
  add("demographics.age", `${ehr.age} years old`);
  add("demographics.sex", ehr.sex === "F" ? "Female" : ehr.sex === "M" ? "Male" : ehr.sex);
  for (const dx of ehr.primary_diagnoses) add("primary_diagnoses", dx);
  for (const dx of ehr.comorbidities) add("comorbidities", dx);
  for (const c of ehr.profile.chronic_conditions) add("profile.chronic_conditions", c);
  for (const m of ehr.profile.home_medications) add("profile.home_medications", `${m.name} ${m.dose}`);
  for (const a of ehr.profile.allergies) add("profile.allergies", a);
  for (const s of ehr.profile.surgical_history) add("profile.surgical_history", s);
  add("profile.occupation", ehr.profile.occupation);
  add("profile.smoking_status", ehr.profile.smoking_status);
  add("profile.alcohol_use", ehr.profile.alcohol_use);
  for (const f of ehr.profile.family_history) add("profile.family_history", f);

  const encounters = [...ehr.encounters].sort((a, b) => a.encounter_date.localeCompare(b.encounter_date));
  for (const enc of encounters) {
    add("encounter.visit", `${enc.encounter_type} visit, ${enc.department}, ${enc.attending_name}`, enc);
    add("encounter.chief_complaint", enc.chief_complaint, enc);
    const sections = noteSections(enc.note_text);
    const hpi = sections["HISTORY OF PRESENT ILLNESS"];
    if (hpi) add("encounter.note.hpi", firstSentences(hpi, 2), enc);
    const ap = sections["ASSESSMENT AND PLAN"] ?? sections["PLAN"];
    if (ap) add("encounter.note.plan", firstSentences(ap, 3), enc);
    const social = sections["SOCIAL HISTORY"];
    if (social && /live|caregiver|daughter|son|wife|husband|partner|alone|aide/i.test(social)) {
      add("encounter.note.social", firstSentences(social, 2), enc);
    }
  }

  // Seeded (synthetic) layer: clearly labeled as such.
  add("seed.caregiver", seed.caregiver ?? "");
  add("seed.upcoming_visit", `${seed.upcomingVisit.department}: ${seed.upcomingVisit.reason} (in ${seed.upcomingVisit.daysUntil} days)`);
  add("seed.stated_language", seed.statedLanguage === "es" ? "Spanish (patient-stated)" : "English (patient-stated)");

  return facts;
}

/**
 * Contradictions and oddities in the record. Shown to staff, never repeated
 * to the patient. Rule-based on purpose.
 */
export function dataQualityWarnings(record: PatientRecord): string[] {
  const warnings: string[] = [];
  const { ehr } = record;
  const allDx = [...ehr.primary_diagnoses, ...ehr.comorbidities, ...ehr.profile.chronic_conditions];
  const sex = ehr.sex;

  const maleOnly = /\b(male breast|prostat|testic|erectile|benign prostatic)/i;
  const femaleOnly = /\b(pregnan|ovar|uter|cervi|menstru|vasa previa|peripartum|postpartum|primiparity|multiparity|breastfeeding|cesarean)/i;
  for (const dx of allDx) {
    if (sex === "F" && maleOnly.test(dx)) warnings.push(`Record lists "${dx}" for a patient documented as female. Verify before use.`);
    if (sex === "M" && femaleOnly.test(dx)) warnings.push(`Record lists "${dx}" for a patient documented as male. Verify before use.`);
  }

  if (ehr.age < 12 && allDx.some((d) => /dementia|alzheimer/i.test(d))) {
    warnings.push("Dementia diagnosis recorded for a child. Verify before use.");
  }

  const seen = new Set<string>();
  for (const dx of ehr.primary_diagnoses) {
    const k = dx.toLowerCase();
    if (ehr.comorbidities.some((c) => c.toLowerCase() === k) && !seen.has(k)) {
      seen.add(k);
      warnings.push(`"${dx}" appears as both a primary diagnosis and a comorbidity.`);
    }
  }

  // Age consistency across encounter dates.
  const dates = ehr.encounters.map((e) => e.encounter_date).sort();
  if (dates.length > 1) {
    const span = (new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / (365.25 * 24 * 3600 * 1000);
    if (span > ehr.age) warnings.push("Encounter dates span more years than the patient's recorded age.");
  }

  return warnings;
}

export function latestEncounter(record: PatientRecord): Encounter | undefined {
  return [...record.ehr.encounters].sort((a, b) => b.encounter_date.localeCompare(a.encounter_date))[0];
}
