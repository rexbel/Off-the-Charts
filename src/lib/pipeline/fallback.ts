import type {
  Claim,
  ClinicianBrief,
  Fact,
  Language,
  PatientContext,
  PatientRecord,
  PersonaProfile,
  PrivacyRule,
  Recipient,
  RenderedMessage,
  RenderedOutputs,
  VideoScript,
  VisitSummary,
  VoiceGuide,
} from "@/lib/schemas";
import { dataQualityWarnings, latestEncounter } from "./extract-facts";

/**
 * Deterministic fallback for every model stage. Rules, not vibes: this is what
 * runs when the model is unavailable, times out, or returns something that
 * fails the schema. It is intentionally plainer than the live output, and the
 * UI labels it as "fallback".
 */

// ---------------------------------------------------------------------------
// Condition detection over facts
// ---------------------------------------------------------------------------

const COND = {
  anxiety: /anxiety|\bGAD\b|panic/i,
  depression: /depress|\bMDD\b/i,
  dementia: /dementia|alzheimer|delirium|frontotemporal/i,
  stroke: /stroke|\bMCA\b|aphasia|hemipare/i,
  oud: /opioid|heroin|substance use|withdrawal/i,
  hiv: /\bHIV\b|\bAIDS\b|antiretroviral/i,
  pregnancy: /pregnan|peripartum|postpartum|twin/i,
  cancer: /cancer|carcinoma|metasta|neoplasm|lymphoma|hodgkin|melanoma|chemo|trastuzumab/i,
  diabetes: /diabet|glucose|\bDKA\b|hypoglyc|insulin/i,
  weight: /\bPCOS\b|obes|insulin resistance|weight/i,
  autism: /autism/i,
  heart: /cardiomyopathy|heart|\bHFrEF\b|mitral|\bHOCM\b|hypertroph|cardiotox|atrial fib|\bAFib\b/i,
  psychosis: /schizo/i,
  bleeding: /von willebrand|hemophilia|bleeding disorder/i,
  sleep: /sleep apnea|\bOSA\b/i,
  pressureUlcer: /pressure ulcer|pressure injury/i,
};

type CondKey = keyof typeof COND;

function factIds(facts: Fact[], re: RegExp, fields?: RegExp): string[] {
  return facts
    .filter((f) => re.test(f.value) && (!fields || fields.test(f.field)))
    .map((f) => f.id);
}

const DX_FIELDS = /primary_diagnoses|comorbidities|chronic_conditions|chief_complaint|note\.hpi|note\.plan/;

function has(facts: Fact[], key: CondKey): string[] {
  return factIds(facts, COND[key], DX_FIELDS);
}

// ---------------------------------------------------------------------------
// Recipients
// ---------------------------------------------------------------------------

function parseCaregiver(raw: string | null): { name?: string; relationship: string }[] {
  if (!raw) return [];
  return raw
    .split(/\s*(?:\+|&| and )\s*/i)
    .map((part) => {
      const m = part.trim().match(/^(.*?)\s*\((.*?)\)$/);
      if (m) return { name: m[1].trim(), relationship: m[2].trim().toLowerCase() };
      return { relationship: part.trim().toLowerCase() };
    })
    .filter((c) => c.relationship);
}

export function recipientsFor(record: PatientRecord, context: PatientContext): Recipient[] {
  const caregivers = parseCaregiver(record.seed.caregiver);
  const patient: Recipient = { role: "patient", name: record.seed.preferredName, primary: true };
  const cg = (i: number, role?: string, primary = false): Recipient | null => {
    const c = caregivers[i];
    if (!c) return null;
    return { role: role ?? c.relationship.replace(/\s+/g, "_"), name: c.name, relationship: c.relationship, primary };
  };
  switch (context.audience) {
    case "self":
      return [patient];
    case "caregiver": {
      const c = cg(0, undefined, true) ?? { role: "caregiver", relationship: "caregiver", primary: true };
      return [c, { ...patient, primary: false }];
    }
    case "care_partner": {
      const c = cg(0, "care_partner") ?? { role: "care_partner", relationship: "care partner", primary: false };
      return [patient, c];
    }
    case "dual_teen_guardian": {
      const c = cg(0, "guardian") ?? { role: "guardian", relationship: "parent or guardian", primary: false };
      return [patient, c];
    }
    case "dual_child_parent": {
      const c = cg(0, "parent", true) ?? { role: "parent", relationship: "parent", primary: true };
      return [c, { ...patient, role: "child", primary: false }];
    }
    case "self_plus_caregiver": {
      const c = cg(0) ?? { role: "caregiver", relationship: "caregiver", primary: false };
      return [patient, c];
    }
    case "self_plus_family": {
      const c = cg(0) ?? { role: "family", relationship: "family member", primary: false };
      return [patient, c];
    }
    case "multi_caregiver": {
      const list = caregivers.map((c, i) => cg(i, undefined, i === 0)!).filter(Boolean);
      return list.length ? [...list, { ...patient, primary: false }] : [{ role: "caregiver", relationship: "caregiver", primary: true }, { ...patient, primary: false }];
    }
  }
}

export function primaryRecipient(recipients: Recipient[]): Recipient {
  return recipients.find((r) => r.primary) ?? recipients[0];
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function fallbackProfile(record: PatientRecord, facts: Fact[], context: PatientContext): PersonaProfile {
  const { seed, ehr } = record;
  let n = 0;
  const claim = (text: string, kind: Claim["kind"], ids: string[], reason?: string): Claim => ({
    id: `c${++n}`,
    text,
    kind,
    source: { factIds: ids, note: kind === "patient_stated" ? "What matters to you check-in" : undefined },
    reason,
  });

  const recipients = recipientsFor(record, context);
  const primary = primaryRecipient(recipients);
  const emotional: Claim[] = [];
  const cognitive: Claim[] = [];
  const strengths: Claim[] = [];
  const privacy: PrivacyRule[] = [];
  const avoid = new Set<string>(["non-compliant", "denies", "refused", "failed"]);

  if (context.checkin.trim()) {
    emotional.push(claim(`In their words: "${context.checkin.trim()}"`, "patient_stated", []));
  }

  const anx = has(facts, "anxiety");
  if (anx.length) emotional.push(claim("Anxiety is on the problem list, so say what will happen, how long it takes and who will be there before the visit.", "inferred", anx, "Predictability lowers anticipatory anxiety."));
  const dep = has(facts, "depression");
  if (dep.length) emotional.push(claim("Depression is on the problem list. Keep messages warm and short, and offer a human to talk to.", "inferred", dep, "Low energy makes long instructions hard to act on."));
  const canc = has(facts, "cancer");
  if (canc.length) emotional.push(claim("Scans and results carry weight here. Name when results will come and who will call.", "inferred", canc, "Result-waiting is a known anxiety point in cancer care."));
  const preg = has(facts, "pregnancy");
  if (preg.length) emotional.push(claim("Recent or current pregnancy. Acknowledge the family context and avoid alarm words.", "inferred", preg, "Perinatal patients report wanting reassurance plus specifics."));
  const oud = has(facts, "oud");
  if (oud.length) {
    emotional.push(claim("Opioid use disorder in the chart. Use person-first recovery language and say plainly that withdrawal will be prevented.", "inferred", oud, "People who have felt judged disengage when language implies blame."));
    for (const t of ["abuse", "abuser", "addict", "drug-seeking", "clean", "dirty", "relapse", "junkie", "user"]) avoid.add(t);
    privacy.push({
      id: `p${privacy.length + 1}`,
      rule: "Do not name the substance, withdrawal or buprenorphine in a text message.",
      restrictedTerms: ["opioid", "heroin", "withdrawal", "buprenorphine", "Suboxone", "substance", "methadone"],
      channels: ["sms"],
      recipients: [],
      kind: "inferred",
      source: { factIds: oud },
      reason: "Text messages are often visible to others.",
    });
  }
  const hiv = has(facts, "hiv");
  if (hiv.length) {
    privacy.push({
      id: `p${privacy.length + 1}`,
      rule: "Do not name HIV or antiretroviral medication in a text message.",
      restrictedTerms: ["HIV", "AIDS", "antiretroviral", "viral load", "infectious disease"],
      channels: ["sms"],
      recipients: [],
      kind: "inferred",
      source: { factIds: hiv },
      reason: "Diagnosis privacy; phones may be shared.",
    });
    emotional.push(claim("Privacy first. Refer to 'your care team' rather than the clinic name in texts.", "inferred", hiv, "Stigma risk if a message is seen by someone else."));
  }
  if (/shar(e|ing) (a |my |the )?phone/i.test(context.checkin)) {
    privacy.push({
      id: `p${privacy.length + 1}`,
      rule: "Patient shares a phone. Keep diagnoses out of texts entirely.",
      restrictedTerms: ehr.primary_diagnoses.map((d) => d.split(/[,(]/)[0].trim()).filter((d) => d.length > 3),
      channels: ["sms"],
      recipients: [],
      kind: "patient_stated",
      source: { factIds: [], note: "What matters to you check-in" },
    });
  }
  if (context.audience === "dual_teen_guardian") {
    const mh = [...dep, ...anx];
    if (mh.length) {
      privacy.push({
        id: `p${privacy.length + 1}`,
        rule: "Mental-health care is confidential for the teen. Guardian messages cover logistics only.",
        restrictedTerms: ["depression", "antidepressant", "mental health", "therapy", "counseling", "sertraline", "fluoxetine", "mood"],
        channels: ["sms", "portal", "phone"],
        recipients: ["guardian"],
        kind: "inferred",
        source: { factIds: mh },
        reason: "Adolescent confidentiality for mental-health care.",
      });
    }
  }

  const dem = has(facts, "dementia");
  const strk = has(facts, "stroke");
  if (dem.length) {
    cognitive.push(claim(`${seed.preferredName} lives with dementia. Speak to ${seed.preferredName} with dignity first, then co-address ${primary.name ?? "the caregiver"}.`, "fact", dem));
    cognitive.push(claim("One idea per sentence. Short sentences, familiar words, no new rooms without a heads-up.", "inferred", dem, "Cognitive load and unfamiliar settings increase confusion."));
    for (const t of ["demented", "senile", "confused patient", "wanderer"]) avoid.add(t);
  }
  if (strk.length) {
    cognitive.push(claim("After a stroke, use short sentences and pictures. Repeat the key step at the end.", "inferred", strk, "Aphasia and fatigue after stroke."));
  }
  const bestTime = /morning/i.test(context.checkin) ? "morning" : /afternoon/i.test(context.checkin) ? "afternoon" : undefined;
  if (bestTime) cognitive.push(claim(`Best time of day: ${bestTime}.`, "patient_stated", []));

  const aut = has(facts, "autism");
  if (aut.length) cognitive.push(claim("Sensory-aware prep: pictures of the room, a quiet waiting option, and no surprises.", "inferred", aut, "Autism on the problem list; check-in mentions sensory needs."));

  const wt = has(facts, "weight");
  if (wt.length) for (const t of ["obese", "overweight", "lose weight", "diet"]) avoid.add(t);
  const psy = has(facts, "psychosis");
  if (psy.length) {
    for (const t of ["schizophrenic", "psychotic"]) avoid.add(t);
    emotional.push(claim("Low-stimulation, consent-forward exam. Ask before each step.", "inferred", psy, "Predictability and consent reduce distress."));
  }

  const occ = facts.find((f) => f.field === "profile.occupation");
  if (occ && !/unemployed|retired|none|n\/a/i.test(occ.value)) strengths.push(claim(`Works as ${occ.value.toLowerCase()}. Use that as common ground when it helps.`, "fact", [occ.id]));
  const cgFact = facts.find((f) => f.field === "seed.caregiver");
  if (cgFact) strengths.push(claim(`Has support: ${cgFact.value}.`, "fact", [cgFact.id]));
  const neverSmoke = facts.find((f) => f.field === "profile.smoking_status" && /never/i.test(f.value));
  if (neverSmoke) strengths.push(claim("Never smoked.", "fact", [neverSmoke.id]));

  const readingLevel = dem.length || strk.length ? 4 : context.audience === "dual_child_parent" ? 4 : 6;
  const detailPreference: PersonaProfile["communicationNeeds"]["detailPreference"] =
    /written plan|detail|numbers|exact/i.test(context.checkin) || anx.length ? "stepwise" : dem.length ? "brief" : "brief";

  const summaryBits = [
    `${seed.preferredName}, ${ehr.age}`,
    seed.personaArchetype.toLowerCase(),
    primary.role !== "patient" ? `messages go to ${primary.name ?? primary.role}` : null,
    bestTime ? `best in the ${bestTime}` : null,
  ].filter(Boolean);

  return {
    patientId: record.patientId,
    preferredName: seed.preferredName,
    summaryLine: summaryBits.join(" · "),
    audience: context.audience,
    recipients,
    communicationNeeds: {
      readingLevel,
      detailPreference,
      language: context.language,
      channel: context.channel,
      bestTimeOfDay: bestTime,
    },
    emotionalContext: emotional,
    privacyRules: privacy,
    cognitiveSupport: cognitive,
    strengths,
    avoidTerms: [...avoid],
    dataQualityWarnings: dataQualityWarnings(record),
  };
}

// ---------------------------------------------------------------------------
// Voice guide
// ---------------------------------------------------------------------------

export function fallbackVoiceGuide(profile: PersonaProfile, record: PatientRecord): VoiceGuide {
  const es = profile.communicationNeeds.language === "es";
  const primary = primaryRecipient(profile.recipients);
  const patientFirst = profile.recipients[0]?.role === "patient";
  const dept = record.seed.upcomingVisit.department;
  const cognitive = profile.cognitiveSupport.length > 0;
  const name = primary.name?.split(" ")[0] ?? (es ? "hola" : "there");

  const addressing = (() => {
    if (profile.recipients.length === 1) return es ? `Hable directamente con ${profile.preferredName}.` : `Speak directly to ${profile.preferredName}.`;
    if (profile.audience === "caregiver" || profile.audience === "dual_child_parent" || profile.audience === "multi_caregiver") {
      return es
        ? `Escriba a ${primary.name ?? primary.relationship}; mencione a ${profile.preferredName} con dignidad.`
        : `Write to ${primary.name ?? primary.relationship}; name ${profile.preferredName} with dignity, never as "the patient".`;
    }
    if (profile.audience === "dual_teen_guardian") return `Two messages: ${profile.preferredName} first (full content), then the guardian (logistics only).`;
    const other = profile.recipients[1];
    return es
      ? `Hable primero con ${profile.preferredName}, luego con ${other?.name ?? other?.relationship ?? "la familia"}.`
      : `Speak to ${profile.preferredName} first, then ${other?.name ?? other?.relationship ?? "family"}.`;
  })();

  return {
    tone: cognitive ? (es ? ["calmado", "claro", "digno"] : ["calm", "plain", "dignified"]) : es ? ["cálido", "concreto", "sin prisa"] : ["warm", "concrete", "unhurried"],
    doSay: es
      ? ["Qué va a pasar y cuánto dura", "Puede traer a alguien", "Escríbanos si tiene preguntas"]
      : ["What will happen and how long it takes", "You can bring someone", "Text us if you have questions", patientFirst ? "Use the first name" : `Say "${profile.preferredName}" not "the patient"`],
    dontSay: [...profile.avoidTerms.slice(0, 6), es ? "debe" : "must", es ? "incumplimiento" : "non-compliance"],
    sentenceMaxWords: cognitive ? 9 : profile.audience === "dual_teen_guardian" ? 14 : 12,
    addressing,
    greeting: es ? `Hola ${name},` : `Hi ${name},`,
    signoff: es ? `Su equipo de ${dept}` : `Your ${dept} team`,
    choicePhrases: es ? ["Si quiere, puede...", "Usted decide", "Podemos esperar"] : ["If you'd like, you can...", "Your choice", "We can pause any time"],
    safetyPhrases: es ? ["Escríbanos o llame al 555-0100", "Si algo no se siente bien, díganos"] : ["Text or call us at 555-0100", "If anything feels off, tell us"],
  };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

const DEPT_FRIENDLY: Record<string, { en: string; es: string }> = {
  Cardiology: { en: "heart", es: "del corazón" },
  Endocrinology: { en: "diabetes and hormone", es: "de diabetes y hormonas" },
  "Pediatric Endocrinology": { en: "diabetes", es: "de diabetes" },
  Neurology: { en: "brain and nerve", es: "de neurología" },
  Hematology: { en: "blood", es: "de sangre" },
  Pulmonology: { en: "lung and sleep", es: "de pulmón y sueño" },
  "Obstetrics & Gynecology": { en: "women's health", es: "de salud de la mujer" },
  "Medical Oncology": { en: "cancer care", es: "de oncología" },
  "Infectious Diseases": { en: "care team", es: "de su equipo" },
  "Internal Medicine": { en: "clinic", es: "de la clínica" },
  "Developmental-Behavioral Pediatrics": { en: "development", es: "de desarrollo" },
};

function deptFriendly(dept: string, lang: Language): string {
  const f = DEPT_FRIENDLY[dept];
  if (!f) return lang === "es" ? "de la clínica" : "clinic";
  return f[lang];
}

/** Replaces restricted terms for the given channel/recipient with a neutral phrase. */
export function scrubForPrivacy(text: string, rules: PrivacyRule[], channel: PatientContext["channel"], recipient: string, lang: Language): string {
  let out = text;
  for (const rule of rules) {
    if (!rule.channels.includes(channel)) continue;
    if (rule.recipients.length && !rule.recipients.includes(recipient)) continue;
    for (const term of rule.restrictedTerms) {
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      out = out.replace(re, lang === "es" ? "su atención" : "your care");
    }
  }
  return out;
}

export function fallbackRender(record: PatientRecord, profile: PersonaProfile, guide: VoiceGuide, facts: Fact[], context: PatientContext): RenderedOutputs {
  const lang = profile.communicationNeeds.language;
  const es = lang === "es";
  const primary = primaryRecipient(profile.recipients);
  const dept = record.seed.upcomingVisit.department;
  const friendly = deptFriendly(dept, lang);
  const name = profile.preferredName;
  const toCaregiver = primary.role !== "patient";
  const companion = profile.recipients.find((r) => !r.primary && r.role !== "patient" && r.role !== "child");
  const claimIds = (re: RegExp) =>
    [...profile.emotionalContext, ...profile.cognitiveSupport, ...profile.strengths].filter((c) => re.test(c.text)).map((c) => c.id);
  const cognitiveIds = profile.cognitiveSupport.map((c) => c.id);
  const statedIds = profile.emotionalContext.filter((c) => c.kind === "patient_stated").map((c) => c.id);
  const privacyIds = profile.privacyRules.map((p) => p.id);
  const scrub = (t: string) => scrubForPrivacy(t, profile.privacyRules, profile.communicationNeeds.channel, primary.role, lang);

  const greeting = guide.greeting;
  const signoff = guide.signoff;
  const safety = guide.safetyPhrases[0] ?? (es ? "Escríbanos al 555-0100." : "Text us at 555-0100.");
  const bring = companion
    ? es
      ? `Puede venir ${companion.name ?? companion.relationship ?? "alguien"} con usted.`
      : `${companion.name ?? companion.relationship ?? "Someone"} can come with ${toCaregiver ? "him or her" : "you"}.`
    : es
      ? "Puede traer a alguien si quiere."
      : "You can bring someone if you'd like.";

  const reason = record.seed.upcomingVisit.reason;
  const reasonLower = reason.charAt(0).toLowerCase() + reason.slice(1);

  const m7 = es
    ? `${greeting} ${toCaregiver ? `${name} tiene` : "usted tiene"} una visita ${friendly} el {{date}} a las {{time}}. Es para: ${reasonLower}. Dura unos 40 minutos. ${bring} ${safety}\n${signoff}`
    : `${greeting} ${toCaregiver ? `${name} has` : "you have"} a ${friendly} visit on {{date}} at {{time}}. It's for: ${reasonLower}. It takes about 40 minutes. ${bring} ${safety}\n${signoff}`;

  const steps = es
    ? ["Llegue 10 minutos antes.", "Le tomaremos la presión.", `Luego hablará con el equipo sobre ${reasonLower}.`]
    : ["Arrive 10 minutes early.", "We'll check blood pressure first.", `Then you'll talk through ${reasonLower} with the team.`];
  const quietLine = profile.cognitiveSupport.length
    ? es
      ? " Podemos ofrecer una sala tranquila."
      : ` We can set up a quiet room for ${toCaregiver ? name : "you"}.`
    : "";
  const m2 = es
    ? `${greeting} recordatorio: {{weekday}} a las {{time}}, visita ${friendly}. Qué va a pasar: ${steps.join(" ")}${quietLine} Si prefiere otra hora, díganos. ${safety}\n${signoff}`
    : `${greeting} a quick note for {{weekday}} at {{time}}, the ${friendly} visit. What will happen: ${steps.join(" ")}${quietLine} If another time works better, just say so. ${safety}\n${signoff}`;

  const m24 = es
    ? `${greeting} gracias por venir hoy. Su resumen está en el portal, en palabras sencillas. Siga tomando sus medicinas igual. Si algo no se siente bien, escríbanos. Decidimos los próximos pasos juntos.\n${signoff}`
    : `${greeting} thanks for coming in today. Your summary is in the portal, written in plain words. Keep taking your medicines the same way. If anything feels off, text us. We'll decide next steps together.\n${signoff}`;

  const messages: RenderedMessage[] = [
    { stage: "before_7d", recipient: primary.role, persona: scrub(m7), claimIds: [...statedIds, ...claimIds(/support|works as/i), ...privacyIds] },
    { stage: "before_2d", recipient: primary.role, persona: scrub(m2), claimIds: [...claimIds(/anxiety|predict|say what will happen/i), ...cognitiveIds, ...privacyIds] },
    { stage: "after_24h", recipient: primary.role, persona: scrub(m24), claimIds: [...statedIds] },
  ];

  const latest = latestEncounter(record);
  const topDx = record.ehr.primary_diagnoses[0] ?? latest?.chief_complaint ?? "";
  const briefLines = [
    `${name}, ${record.ehr.age}. ${topDx}. Visit: ${reason}.`,
    guide.addressing,
    context.checkin ? `What matters to ${toCaregiver ? "the family" : name}: "${context.checkin.trim()}"` : "",
    profile.emotionalContext.find((c) => c.kind === "inferred")?.text ?? "",
    profile.cognitiveSupport[0]?.text ?? "",
    profile.privacyRules[0] ? `Privacy: ${profile.privacyRules[0].rule}` : "",
    profile.avoidTerms.length ? `Avoid: ${profile.avoidTerms.slice(0, 5).join(", ")}.` : "",
    profile.dataQualityWarnings.length ? `Chart check: ${profile.dataQualityWarnings[0]}` : "",
  ].filter(Boolean).slice(0, 8);
  const words = briefLines.join(" ").split(/\s+/).length;
  const clinicianBrief: ClinicianBrief = {
    lines: briefLines,
    readAloudSeconds: Math.round(words / 2.6),
    claimIds: [...statedIds, ...profile.emotionalContext.map((c) => c.id), ...cognitiveIds, ...privacyIds],
  };

  const whenToCall = whenToCallFor(facts, lang);
  const visitSummary: VisitSummary = {
    headline: es ? `Su visita ${friendly}, {{date}}` : `Your ${friendly} visit, {{date}}`,
    whatWeTalkedAbout: [
      { text: es ? `Hablamos de: ${reasonLower}.` : `We talked about: ${reasonLower}.`, claimIds: [] },
      ...(latest ? [{ text: es ? `Su última visita fue por: ${latest.chief_complaint.toLowerCase()}.` : `Your last visit was about: ${latest.chief_complaint.toLowerCase()}.`, claimIds: [] }] : []),
    ],
    yourNextSteps: es
      ? ["Siga tomando sus medicinas igual que ahora.", "Anote preguntas para la próxima vez.", "Le llamaremos con los resultados."]
      : ["Keep taking your medicines the same way as now.", "Write down questions for next time.", "We will call you with results."],
    whenToCall,
    questionsForNextTime: es
      ? ["¿Qué cambia si los resultados son distintos?", "¿Qué puedo hacer en casa?"]
      : ["What changes if the results are different?", "What can I do at home?"],
  };

  const videoScripts: VideoScript[] = [
    {
      stage: "before",
      title: es ? `Antes de su visita, ${name}` : `Before your visit, ${name}`,
      scenes: [
        { kind: "title", title: es ? "Antes de su visita" : "Before your visit", text: es ? `Hola, ${name}.` : `Hi, ${name}.`, voiceover: es ? `Hola ${name}. Esto es lo que va a pasar en su visita.` : `Hi ${name}. Here is what will happen at your visit.` },
        { kind: "card", title: es ? "Cuándo y dónde" : "When and where", text: `{{date}}, {{time}}`, voiceover: es ? `Su visita es el {{date}} a las {{time}}. Dura unos 40 minutos.` : `Your visit is {{date}} at {{time}}. It takes about 40 minutes.` },
        { kind: "steps", title: es ? "Qué va a pasar" : "What will happen", text: "", items: steps, voiceover: steps.join(" ") },
        { kind: "choice", title: es ? "Usted decide" : "Your choice", text: es ? "Puede..." : "You can...", items: es ? ["Traer a alguien", "Pedir una pausa", "Hacer preguntas"] : ["Bring someone", "Ask for a break", "Ask questions any time"], voiceover: es ? "Puede traer a alguien, pedir una pausa o hacer preguntas en cualquier momento." : "You can bring someone, ask for a break, or ask questions any time." },
        { kind: "closing", title: es ? "Estamos aquí" : "We're here", text: safety, voiceover: es ? `Si tiene preguntas antes, escríbanos. Nos vemos pronto.` : `If you have questions before then, text us. See you soon.` },
      ],
    },
    {
      stage: "after",
      title: es ? `Después de su visita, ${name}` : `After your visit, ${name}`,
      scenes: [
        { kind: "title", title: es ? "Después de su visita" : "After your visit", text: es ? `Gracias, ${name}.` : `Thanks, ${name}.`, voiceover: es ? `Gracias por venir, ${name}. Aquí está su plan en palabras sencillas.` : `Thanks for coming in, ${name}. Here is your plan in plain words.` },
        { kind: "card", title: es ? "De qué hablamos" : "What we talked about", text: reason, voiceover: es ? `Hablamos de ${reasonLower}.` : `We talked about ${reasonLower}.` },
        { kind: "steps", title: es ? "Sus próximos pasos" : "Your next steps", text: "", items: visitSummary.yourNextSteps, voiceover: visitSummary.yourNextSteps.join(" ") },
        { kind: "closing", title: es ? "Cuándo llamar" : "When to call", text: whenToCall[0] ?? safety, voiceover: `${whenToCall[0] ?? ""} ${safety}`.trim() },
      ],
    },
  ];

  return { messages, clinicianBrief, visitSummary, videoScripts };
}

function whenToCallFor(facts: Fact[], lang: Language): string[] {
  const es = lang === "es";
  if (has(facts, "heart").length)
    return es
      ? ["Dolor en el pecho o falta de aire: llame al 911.", "Hinchazón nueva o aumento de 1 kilo en un día: llámenos."]
      : ["Chest pain or trouble breathing: call 911.", "New swelling or 3 pounds up in a day: call us."];
  if (has(facts, "diabetes").length)
    return es
      ? ["Azúcar muy baja que no sube: llame al 911.", "Vómitos o azúcar alta todo el día: llámenos."]
      : ["Very low sugar that won't come up: call 911.", "Vomiting or high sugar all day: call us."];
  if (has(facts, "dementia").length)
    return es
      ? ["Confusión repentina o fiebre: llámenos el mismo día.", "Caída o no quiere beber: llámenos."]
      : ["Sudden new confusion or fever: call us the same day.", "A fall or not drinking: call us."];
  return es
    ? ["Si algo empeora de repente: llame al 911.", "Si tiene dudas: escríbanos o llame al 555-0100."]
    : ["If something gets worse suddenly: call 911.", "If you're unsure: text or call us at 555-0100."];
}
