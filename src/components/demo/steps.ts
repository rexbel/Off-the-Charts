import { DEMO_PATIENT_IDS } from "@/lib/data/cohort";

/**
 * The guided walkthrough. Each step navigates to a route, spotlights one
 * element (by data-demo attribute) and narrates what to look at. Builds run
 * in "cached" mode so the walkthrough is fast and identical every time; the
 * UI labels that output "Cached output".
 */
export type DemoStep = {
  id: string;
  title: string;
  /** One or two sentences, spoken-word register. */
  narration: string;
  /** Optional second paragraph with the "why" for judges or stakeholders. */
  why?: string;
  route: string;
  spotlight?: string;
  /** Optional nudge, e.g. "Click Approve on the 2-day message." */
  tryIt?: string;
};

const E = DEMO_PATIENT_IDS.ideal;
const W = DEMO_PATIENT_IDS.complex;
const J = DEMO_PATIENT_IDS.edge;
const G = 2861; // contradictory record (female patient, "male breast" neoplasm)

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "problem",
    title: "The problem",
    narration: "This is the reminder a clinic sends today. The same text goes to a 9-year-old with new diabetes, a 29-year-old in recovery, and a 75-year-old with Alzheimer's.",
    why: "Automated messages and AI scribes ignore who is reading. Generic or stigmatizing language erodes trust and adherence.",
    route: "/demo",
    spotlight: "generic-reminder",
  },
  {
    id: "cohort",
    title: "The cohort",
    narration: "Twenty synthetic patients, ages 3 to 75, each with an upcoming visit. Badges show who the messages go to: the patient, a caregiver, or a teen and guardian separately.",
    why: "EHR records come from an MIT-licensed synthetic hospital dataset. Names, visits and check-ins are seeded. Nothing here is a real person.",
    route: "/",
    spotlight: "cohort-board",
  },
  {
    id: "context",
    title: "Emily's chart and her words",
    narration: "Emily is 32, a teacher, with peripartum cardiomyopathy and twins at home. On the left, her chart. On the right, what she told us matters: she wants a written plan and worries about her heart.",
    why: "The check-in is patient-stated. The engine never infers language, values or literacy from race, ethnicity or insurance.",
    route: `/patients/${E}?tab=messages`,
    spotlight: "context-panel",
  },
  {
    id: "build",
    title: "Build the Persona",
    narration: "Four stages. Extract facts from the chart with rules. Then the model writes a Persona Profile and a Voice Guide. Then it renders every touchpoint. Then rules check the result.",
    why: "In this walkthrough the model stages replay precomputed output when a cache exists for the patient; otherwise the rules-based fallback runs. The badge on each stage says which. A live build calls the model.",
    route: `/patients/${E}?build=cached&tab=messages`,
    spotlight: "pipeline",
  },
  {
    id: "messages",
    title: "Same chart, different message",
    narration: "Left is today's template. Right is Emily's. Same clinic, same EHR. The score is computed by the same rules on both: reading grade, stigma terms, choice, predictability, safety, privacy.",
    why: "The message now answers the question she would lie awake with: what will happen, how long, and who will be there.",
    route: `/patients/${E}?tab=messages`,
    spotlight: "messages",
    tryIt: "Expand the findings under a score to see every rule that fired.",
  },
  {
    id: "video",
    title: "Before-your-visit video",
    narration: "The same engine renders a short captioned video from the Voice Guide. It previews the echo so nothing is a surprise.",
    why: "Rendered in the browser with Remotion. Captions are burned in; voice is the browser's own.",
    route: `/patients/${E}?tab=video`,
    spotlight: "video",
    tryIt: "Press play. Try the scene strip to jump ahead.",
  },
  {
    id: "brief",
    title: "The 30-second clinician brief",
    narration: "Before the clinician walks in: who she is, how to talk to her, what matters in her own words, and what to avoid. Read it aloud and it lands in about thirty seconds.",
    route: `/patients/${E}?tab=brief`,
    spotlight: "brief",
    tryIt: "Click Read aloud.",
  },
  {
    id: "summary",
    title: "A visit summary she can read",
    narration: "Today's after-visit summary is the note at clinical reading level. Hers is at a sixth-grade level, in her voice: what we talked about, next steps, when to call.",
    route: `/patients/${E}?tab=summary`,
    spotlight: "summary",
  },
  {
    id: "walter",
    title: "Why AI: Walter",
    narration: "Walter is 75 with moderate Alzheimer's and delirium after an ICU stay. The same pipeline writes to his daughter Anna, suggests the morning, and still names Walter with dignity.",
    why: "With a live model this is synthesis across the whole chart plus the check-in; the rules fallback is plainer but keeps the same safeguards. Scoring and enforcement stay deterministic on purpose.",
    route: `/patients/${W}?build=cached&tab=messages`,
    spotlight: "messages",
  },
  {
    id: "evidence",
    title: "Trust: every claim cites its source",
    narration: "Open any chip on the Persona Profile. Facts point at the encounter and field. Guesses carry an Inferred badge and need a click to confirm.",
    why: "The render stage sees only cited facts, never the raw note. That keeps every claim citable.",
    route: `/patients/${W}?tab=messages&evidence=1`,
    spotlight: "persona-card",
    tryIt: "Confirm one inferred claim.",
  },
  {
    id: "jake",
    title: "Trust: the checker shows its work",
    narration: "Jake is 29, in recovery, and has been judged before. The checker flags the stigma terms in today's template and the rewrite uses person-first language. The privacy rule keeps the diagnosis out of texts.",
    why: "The checker is rules, not vibes. Every flagged term comes with a suggested replacement.",
    route: `/patients/${J}?build=cached&tab=messages`,
    spotlight: "messages",
  },
  {
    id: "quality",
    title: "Trust: a contradictory record",
    narration: "Grace's chart lists a male breast neoplasm for a female patient. The pipeline flags it as a chart check for staff and never repeats it to her.",
    route: `/patients/${G}?build=cached&tab=brief`,
    spotlight: "data-quality",
  },
  {
    id: "architecture",
    title: "How it works",
    narration: "EHR to facts to Persona Profile to Voice Guide to four renderers to a rules checker to a human approval. It sits in front of any reminder vendor.",
    route: "/how-it-works",
    spotlight: "architecture",
  },
  {
    id: "impact",
    title: "Impact and what's next",
    narration: "Approved touchpoints land in the outbox with before-and-after numbers measured on stored runs against a synthetic composite of common clinic templates: reading grade, trauma-informed score, stigma terms removed, privacy rules enforced.",
    why: "A pilot would measure no-shows, portal engagement and teach-back comprehension. That's care that's off the chart.",
    route: "/outbox",
    spotlight: "impact",
    tryIt: "Approve a few touchpoints on a patient to watch the numbers move.",
  },
];
