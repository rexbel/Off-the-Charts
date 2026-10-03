import type { GenericBaseline, PatientRecord } from "@/lib/schemas";
import { latestEncounter, noteSections } from "./extract-facts";
import { visitSlot } from "@/lib/visit";

/**
 * What the clinic sends today: a reminder-vendor template with the chart's
 * reason for visit merged in, and an after-visit summary pasted from the note
 * at clinical reading level. Modeled on common clinic templates; synthetic.
 *
 * This is the "before" in every before/after comparison. It is deliberately
 * not person-aware: same text whether the reader is 9, 29 or 75.
 */
export function genericBaseline(record: PatientRecord, now = new Date()): GenericBaseline {
  const { seed, ehr } = record;
  const slot = visitSlot(seed.upcomingVisit, record.patientId, "en", false, now);
  const dept = seed.upcomingVisit.department;
  const reasons = [...ehr.primary_diagnoses.slice(0, 2)];
  const reasonLine = reasons.join(", ");
  const policyLine = policyLineFor(ehr);

  const before7 =
    `Reminder: ${seed.displayName} has an upcoming appointment with ${dept} on ${slot.longDate} at ${slot.time}. ` +
    `Reason for visit: ${seed.upcomingVisit.reason} (${reasonLine}). ` +
    `Please arrive 15 minutes early with your insurance card, photo ID, and a list of all current medications. ` +
    `Patients who fail to cancel 24 hours in advance may be charged a no-show fee.`;

  const before2 =
    `Appointment reminder: ${dept} in ${seed.upcomingVisit.daysUntil} day(s), ${slot.longDate} ${slot.time}. ` +
    `Dx: ${reasonLine}. ${policyLine}Reply C to confirm or X to cancel. Do not reply with questions; this inbox is not monitored.`;

  const after24 =
    `Thank you for visiting ${dept}. Your after-visit summary and clinical documentation are available in the patient portal. ` +
    `Non-compliance with the documented plan may affect outcomes. Please complete the attached patient satisfaction survey. ` +
    `If you experience symptoms, contact your provider's office during business hours.`;

  const latest = latestEncounter(record);
  const sections = latest ? noteSections(latest.note_text) : {};
  const summaryParts = [
    `AFTER VISIT SUMMARY - ${dept.toUpperCase()}`,
    `Patient: ${seed.displayName}, ${ehr.age}${ehr.sex}. Encounter: ${latest?.encounter_type ?? "outpatient"}, ${latest?.department ?? dept}.`,
    `Chief complaint: ${latest?.chief_complaint ?? seed.upcomingVisit.reason}.`,
    `Active problem list: ${[...ehr.primary_diagnoses, ...ehr.profile.chronic_conditions].slice(0, 6).join("; ")}.`,
    sections["HISTORY OF PRESENT ILLNESS"] ? `HPI: ${sections["HISTORY OF PRESENT ILLNESS"].replace(/\s+/g, " ")}` : "",
    sections["ASSESSMENT AND PLAN"] ? `Assessment and plan: ${sections["ASSESSMENT AND PLAN"].replace(/\s+/g, " ")}` : "",
    `Medications: ${ehr.profile.home_medications.map((m) => `${m.name} ${m.dose}`).join("; ")}.`,
    `Follow-up as directed. Patient instructed to adhere to prescribed regimen and return precautions were reviewed.`,
  ].filter(Boolean);

  return {
    messages: [
      { stage: "before_7d", text: before7 },
      { stage: "before_2d", text: before2 },
      { stage: "after_24h", text: after24 },
    ],
    summary: summaryParts.join("\n"),
  };
}

/** Legacy "policy" sentences many clinics still merge into reminders by condition. */
function policyLineFor(ehr: PatientRecord["ehr"]): string {
  const all = [...ehr.primary_diagnoses, ...ehr.comorbidities, ...ehr.profile.chronic_conditions].join(" ").toLowerCase();
  if (/opioid|substance|heroin/.test(all)) {
    return "Per clinic policy, patients with a history of substance abuse must bring all medication bottles; drug-seeking behavior will be documented. ";
  }
  if (/diabet|glucose|hypoglyc/.test(all)) {
    return "Bring your glucose log. Uncontrolled diabetics must fast for 8 hours before labs. ";
  }
  if (/dementia|alzheimer|delirium/.test(all)) {
    return "Demented patients must be accompanied by a responsible adult. ";
  }
  if (/obes|pcos|insulin resistance/.test(all)) {
    return "Weight will be recorded at check-in. Obese patients should review the diet handout. ";
  }
  if (/hiv|aids/.test(all)) {
    return "HIV clinic patients must bring their antiretroviral medication list. ";
  }
  if (/depress|anxiety|schizo/.test(all)) {
    return "Psychiatric patients must complete the PHQ-9 screening form prior to the visit. ";
  }
  return "Patients who are non-compliant with pre-visit instructions may be rescheduled. ";
}
