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

/** About three minutes: one patient, Emily, from her chart to after her visit. */
export const DEMO_STEPS: DemoStep[] = [
  {
    id: "problem",
    title: "What a patient hears from us today",
    narration: "This is the reminder a clinic sends today. The same text goes to a 9-year-old with new diabetes, a 29-year-old in recovery, and a 75-year-old with Alzheimer's.",
    why: "Generic or stigmatizing language erodes trust and adherence.",
    route: "/demo",
    spotlight: "generic-reminder",
  },
  {
    id: "context",
    title: "Emily's chart and her words",
    narration: "Emily is 32, a teacher, with peripartum cardiomyopathy and twins at home. On the left, her chart. On the right, the check-in in her own words.",
    why: "The check-in is patient-stated. The engine never infers language, values or literacy from race, ethnicity or insurance.",
    route: `/patients/${E}?tab=messages`,
    spotlight: "context-panel",
  },
  {
    id: "intake",
    title: "The intake: video, then one question",
    narration: "Emily's link opens on her approved before-visit video, then asks one question: what support she needs before, during and after the visit. Her answer becomes the patient-stated lines on her Persona Profile.",
    route: "/demo/intake",
    spotlight: "intake",
    tryIt: "Let the video finish, or press Continue, to see her answer.",
  },
  {
    id: "build",
    title: "Build the Persona",
    narration: "Rules extract facts from the chart. The model writes a Persona Profile and a Voice Guide, then every touchpoint. Rules check the result. Lines that came from her answer carry the person icon.",
    why: "The walkthrough replays precomputed output; each stage is labeled. A live build calls the model.",
    route: `/patients/${E}?build=cached&tab=messages`,
    spotlight: "pipeline",
  },
  {
    id: "messages",
    title: "Same chart, different message",
    narration: "Left is today's template. Right is Emily's. Same rules score both: reading grade, stigma terms, choice, predictability, safety, privacy.",
    route: `/patients/${E}?tab=messages`,
    spotlight: "messages",
  },
  {
    id: "video",
    title: "Before-your-visit video",
    narration: "A short captioned video from the same Voice Guide previews the echo, so nothing is a surprise.",
    route: `/patients/${E}?tab=video`,
    spotlight: "video",
  },
  {
    id: "brief",
    title: "The 30-second clinician brief",
    narration: "Before the clinician walks in: who she is, how to talk to her, what matters in her words, and what to avoid. Read aloud, about thirty seconds.",
    route: `/patients/${E}?tab=brief`,
    spotlight: "brief",
  },
  {
    id: "after-video",
    title: "After-visit video",
    narration: "After the visit, a second video recaps what happened, what to watch for at home, and when to call. That's the after half of her answer.",
    route: `/patients/${E}?tab=video&stage=after`,
    spotlight: "video",
  },
  {
    id: "evidence",
    title: "Trust: every claim cites its source",
    narration: "Open any chip on the Persona Profile. Chart facts point at the encounter and field. Her words point back to the check-in.",
    why: "The render stage sees only cited facts, never the raw note. That keeps every claim citable.",
    route: `/patients/${E}?tab=messages&evidence=1`,
    spotlight: "persona-card",
  },
  {
    id: "architecture",
    title: "How it works",
    narration: "EHR to facts to Persona Profile to Voice Guide to renderers to a rules checker to a human approval. It sits in front of any reminder vendor.",
    route: "/how-it-works",
    spotlight: "architecture",
  },
];
