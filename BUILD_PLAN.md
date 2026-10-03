# Off the Chart — Hackathon Build Plan

> **Status:** Plan complete, awaiting confirmation (Checkpoint 1: Concept Lock). No application code yet.
> **Seed data:** `data/cohort.json` (20 synthetic patients pulled from `sparkcpark/synthetic_hospital` v1.3, plus a seeded persona layer).

---

## 1. Inputs

```text
Hackathon name: Hackers and Healers Hackathon | NYC (DxAngels)
Duration: Fri 6 PM mixer → Sat ~7 PM wrap. Real build window ≈ Fri 8 PM → Sat ~2 PM (about 18 h including sleep)
Team: Rex (full-stack/AI), solo at start; recruit one clinician (RN/NP/MD) at the Friday mixer
Official goal: "Credentialed clinicians (healers) will share the messy realities of patient care; professional builders (hackers) will wield the tools to build scalable solutions."
Options: see §3 (A–F)
Required tech: none mandated
APIs / data: synthetic_hospital (1,268 patients, 5,602 notes, MIT, fully synthetic); Claude API; TTS provider; Remotion
Judging: not published. Live product demo only. NO slide decks allowed.
Submission: a live demo on Saturday
Restrictions: no slides; synthetic data only (no PHI)
Sponsors: Redesign Health, Photon Health, TechNovaTime, Visualize AI
```

**Judging is unpublished.** Assume clinician judges who reward clinical credibility, a working product and one memorable moment.

---

## 2. Challenge interpretation

> We need to show that **clinic care teams** can send **every automated patient touchpoint in language matched to the person and grounded in trauma-informed care**, with less **staff writing time and less risk of alienating patients**, by using **an EHR → persona → voice-guide engine that renders messages, a visit summary, a video and a clinician brief**.

- **Primary user:** clinic care coordinator / nurse who approves outbound patient communications.
- **Secondary users:** the patient or caregiver who receives them; the clinician who reads the 30-second brief.

**Problem.** Automated reminders and AI scribes produce one-size-fits-all text, such as "Reminder: appointment in 2 days. Reply C to confirm." That text ignores who is reading it: a teen whose mental-health care is confidential, a dementia caregiver, a patient in recovery who has been judged before, or someone sharing a phone. Generic or stigmatizing language erodes trust and adherence.

**Current workaround.** Templates with name and date merged in, staff rewriting messages by hand when they have time, after-visit summaries pasted from the note at clinical reading level.

**Required proof in the demo:**

1. The same EHR becomes a visibly different, better message for different people (before/after with a score).
2. Every clinical statement traces back to an EHR source; the guesses are labeled as guesses.
3. One engine produces all four outputs (messages, summary, video, brief) consistently.

---

## 3. Option evaluation

| Option | Impact | Demo | Feas. | AI | Diff. | Data | **Weighted** | Key risk |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| **A. Off the Chart (Persona engine): messages + summary + Remotion video + clinician brief** | 4.5 | 5 | 3.5 | 4.5 | 4.5 | 4 | **4.35** | Four renderers for a solo builder |
| B. Video-first patient prep | 3.5 | 4.5 | 2.5 | 4 | 4 | 3.5 | 3.63 | Rendering / TTS latency; thin clinical substance |
| C. Clinician brief + trauma-informed message rewriter only | 4 | 4 | 4.5 | 4 | 3 | 4 | 4.00 | Less visual "wow" |
| D. Clinician inbox triage | 4.5 | 3.5 | 4 | 4.5 | 2 | 3 | 3.80 | Common hackathon idea |
| E. Prior-auth / paperwork automation | 4.5 | 3 | 3 | 4 | 2 | 2.5 | 3.38 | No credible payer data |
| F. Rx access navigator (Photon Health tie-in) | 4 | 4 | 3.5 | 3.5 | 3 | 3 | 3.63 | Depends on a sponsor API |

**Selected: A.** It clears every gate: demo 5 (≥4), feasibility 3.5 (≥3.5), a visible before/after, one user and one workflow, works on cached output, and has a repeatable moment.

**Why it wins:** It is the only option where the AI does real synthesis (EHR → communication profile) and the result is instantly understandable to non-technical judges. The four outputs share one pipeline, so most of the work is the engine; each renderer is thin.

**Main risk:** solo scope across four renderers.
**Risk reduction:**

- Precompute all 20 patients' outputs Friday night into `data/generated/*.json`.
- Use `@remotion/player` in the browser, so video needs no server render.
- The language checker is rule-based and deterministic.
- Cut order if behind: video → summary styling → extra patients.

**Backup: C** (brief + message rewriter). It is a strict subset of A, so switching means hiding tabs, not rewriting. Switch only if A has no working vertical slice at Checkpoint 2.

---

## 4. Product concept

**Name:** Off the Chart. The underlying engine is called **Persona** (Persona Profiles + Voice Guides).

**Tagline:** "Your chart says what's wrong. Off the Chart says how to talk to you."

**Why this name:** it's a double meaning: the person beyond the chart, and "off the charts" as in excellent. It scored best on memorability and standing out; the pun lands best spoken aloud, so the demo opens with the tagline.

**Pitch:** Off the Chart helps clinic care teams send every automated patient touchpoint in trauma-informed, person-specific language by turning the EHR into an evidence-linked communication profile. It produces messages, a visit summary, a prep video and a 30-second clinician brief that a person approves before anything goes out.

**Narrative:**

1. Today, care teams send generic, clinically worded automated messages that ignore who is reading: caregivers, teens, people in recovery, people with dementia.
2. Off the Chart uses an LLM to turn EHR facts plus a short "What matters to you" check-in into a Persona Profile and a Voice Guide, then renders every touchpoint from them.
3. Communication matches the person, at ≤ 6th-grade reading level and free of stigma. Staff stay in control: every claim cites its EHR source, guesses are labeled, and nothing sends without approval.

**Core hypothesis:** If we provide a person-specific voice guide at the moment a clinic sends any automated message, staff can deliver trauma-informed communication at template speed, because tone, audience, reading level and privacy rules are decided once per patient and enforced on every output.

**Principles:** one workflow; human approval; every claim cited; guesses labeled; graceful fallback to cached output; no dead ends.

---

## 5. Demo cohort (20 patients, `data/cohort.json`)

Names, upcoming visits, caregivers and "What matters" check-in answers are **synthetic seeds**; the dataset has none of these. Language preference is a *patient-stated* seed. It is never inferred from race or ethnicity.

| ID | Age/Sex | Key EHR | Persona basis | Audience |
|---|---|---|---|---|
| 2409 | 3M | Autism spectrum disorder | Sensory-aware caregiver prep | Caregiver |
| 2394 | 9M | DKA → new T1D, G6PD | New-diagnosis family, kid-friendly | Child + parent |
| 2883 | 13F | von Willebrand, MDD | Teen with confidential mental-health care | Teen / guardian (split) |
| 2438 | 14M | HOCM | Identity-threat news (sports restriction) | Teen + parent |
| 1818 | 19F | PCOS, acne, insulin resistance | Weight-neutral, body-image sensitive | Self |
| 1784 | 28F | Pregnancy (T2), GAD | Expecting and anxious, predictability | Self + partner |
| 1772 | 28F | Schizophrenia, pelvic pain disorder | Low-stimulation, consent-forward exam | Self |
| 2544 | 29M | Opioid use disorder, MDD | Stigma-free recovery language (**edge demo**) | Self |
| 1672 | 32F | Peripartum cardiomyopathy, twins, GAD | Anxious detail-seeker (**ideal demo**) | Self |
| 2522 | 35M | HIV/AIDS, IgA nephropathy | Privacy-first (shared phone) | Self |
| 2704 | 46F | Trastuzumab cardiotoxicity, Hodgkin survivor | Scan anxiety, health-literate | Self |
| 2696 | 45F | Severe hypoglycemia, T2DM, SLE | Safety-critical self-management, Spanish (stated) | Self |
| 1976 | 55M | OSA, T2DM, long-haul driver | Livelihood-anxious, schedule-constrained | Self |
| 2774 | 52F | Rheumatic mitral stenosis, pulmonary HTN | Shared decision-making on a procedure | Self + family |
| **1996** | 56M | **Frontotemporal dementia** | Early-onset dementia, dignity-first | Patient + care partner |
| 2265 | 69M | L MCA stroke, AFib | Short sentences and pictures | Self + spouse |
| 2861 | 66F | Metastatic cancer to bone | Serious illness, goals of care | Self + son |
| **2311** | 75M | **Moderate Alzheimer's + delirium, post-ICU** | Caregiver-primary (**complex demo**) | Daughter |
| **2855** | 75F | **Vascular dementia**, pressure ulcer | Multi-caregiver coordination | Son + home aide |
| 2848 | 68F | HFrEF, CKD3 | Daily-routine heart failure, Spanish (stated) | Self + daughter |

**Ages:** 3–75, spread across all bands. **Dementia:** three patients with three different types and stages.

**Dataset caveats to show, not hide:**

- Some records contradict themselves. Example: 2861 lists "malignant neoplasm of male breast" for a female patient.
- The pipeline flags these as **data-quality warnings** rather than repeating them. This is a credibility moment for clinician judges.
- The cohort is mostly Non-Hispanic White, which mirrors the dataset; two non-English seeds were chosen on purpose.

---

## 6. MVP scope

### Core journey (one coordinator, one patient)

1. **Select:** coordinator picks a patient from the cohort board (an upcoming visit is shown).
2. **Review context:** EHR snapshot and the "What matters" check-in answer.
3. **Build:** Persona runs Extract → Persona Profile → Voice Guide → Render.
4. **Review:** tabs for Messages (generic vs. Persona, side by side, with score), Clinician Brief, Visit Summary and Video. Each claim has an evidence chip; guesses carry an "Inferred — confirm" badge.
5. **Approve:** edit or approve each touchpoint; sending is simulated (Sonner toast plus outbox).
6. **Impact:** reading-grade drop, trauma-informed score change, stigma terms removed, privacy rules enforced, touchpoints approved.

### Pipeline and data contracts

```text
EHR record ─► extractFacts (deterministic) ─► PersonaProfile (LLM, Zod)
           ─► VoiceGuide (LLM, Zod) ─► renderers (LLM, Zod) ─► TI checker (rules) ─► UI
```

```ts
type Claim = { text: string; kind: "fact" | "inferred" | "patient_stated"; source?: { encounterId?: number; field: string } }

type PersonaProfile = {
  patientId: number; preferredName: string
  audience: "self" | "caregiver" | "care_partner" | "dual_teen_guardian" | "dual_child_parent" | "self_plus_caregiver" | "multi_caregiver" | "self_plus_family"
  communicationNeeds: {
    readingLevel: number; detailPreference: "brief" | "stepwise" | "numbers"
    language: string; channel: "sms" | "portal" | "phone"
  }
  emotionalContext: Claim[]          // e.g. "anxiety on problem list → give steps ahead of time" (inferred)
  privacyRules: Claim[]              // e.g. "do not name HIV in SMS"; "MDD care not shown to guardian"
  cognitiveSupport?: Claim[]         // dementia / stroke: short sentences, caregiver co-addressed, best time of day
  avoidTerms: string[]; strengths: Claim[]
  dataQualityWarnings: string[]
}

type VoiceGuide = {
  tone: string[]; doSay: string[]; dontSay: string[]
  sentenceMaxWords: number; addressing: string   // e.g. "Speak to Greg first, then Linda"
  choicePhrases: string[]; safetyPhrases: string[]
}

type Outputs = {
  messages: { stage: "before_7d" | "before_2d" | "after_24h"; generic: string; persona: string; claims: Claim[] }[]
  clinicianBrief: { lines: string[]; readAloudSeconds: number }   // ≤ 30 s, about 75 words
  visitSummary: { headline: string; whatWeTalkedAbout: Claim[]; yourNextSteps: string[]; whenToCall: string[]; questionsForNextTime: string[] }
  videoScripts: { stage: "before" | "after"; scenes: { kind: "title" | "card" | "steps" | "choice" | "closing"; text: string; voiceover: string }[] }[]
}
```

### Trauma-informed checker (deterministic, no LLM)

Scores 0–100 and returns the reasons for the score.

- **Reading level:** Flesch-Kincaid grade at or below the profile target.
- **Stigma and blame terms:** for example "non-compliant", "denies", "refused", "abuser", "drug-seeking", "suffers from", "demented", "failed", "obese". Each match suggests a replacement.
- **SAMHSA principles, as rule checks:**
  - Choice offered: the text includes a "you can…" option.
  - Predictability: what will happen, when, and who.
  - Safety: a contact or pause option.
  - Collaboration: "together" / "we'll decide".
- **Privacy rules:** no restricted terms reach the restricted channel or audience.
- **Length:** no sentence over `sentenceMaxWords`.

The generic baseline scores about 30–45 and the Persona version scores 85+, both by the same rules.

### Must-have

- [ ] Cohort board (20 cards: name, age band, visit, persona badge, dementia/caregiver icons)
- [ ] Patient context view (EHR snapshot + check-in, editable)
- [ ] Pipeline with 4 real stages (extract, profile, voice guide, render)
- [ ] Messages tab: generic vs. Persona with TI score and highlighted fixes
- [ ] Clinician Brief tab (30-second read; "read aloud" with TTS)
- [ ] Visit Summary tab (styled, printable, cited)
- [ ] Video tab: `@remotion/player` with an animated card composition and TTS audio
- [ ] Evidence sheet: claim → source encounter / field; Inferred badges
- [ ] Approve / edit / reject per touchpoint → simulated outbox
- [ ] Loading / empty / success / error states; "Cached output" badge when the fallback is used
- [ ] Reset demo button; seeded ideal, complex and edge cases

### Should-have

- [ ] Spanish rendering for 2696 / 2848
- [ ] "Paste your clinic's message" box that rewrites any generic message for the chosen persona (proves the middleware claim)
- [ ] Copy / print summary; MP4 download for the 3 demo cases (pre-rendered)
- [ ] Teen/guardian split view for 2883 (two recipients, different content)

### Non-goals

- Real EHR/FHIR connection
- Real SMS or email sending
- Authentication or RBAC
- Avatar or generative video
- Server-side Remotion rendering at demo time
- More than two languages
- Analytics
- HIPAA infrastructure (synthetic data only)
- Native mobile

### Post-hackathon opportunities

- FHIR `Communication` / `Appointment` integration as middleware in front of existing reminder vendors
- A patient-facing check-in flow so patients can edit their own persona
- A/B pilot measuring no-show rate, portal engagement and teach-back comprehension
- Use the clinician's own phrasing to train the voice guide
- Spoken-word versions for low-literacy patients

---

## 7. Screens (shadcn/ui)

**Shell:** compact top nav, `Badge` "Synthetic data", `Sonner`, `Tooltip`.

1. **Cohort board** (`/`). Pitch line and a "Start with Emily" CTA. A grid of `Card`s with `Badge`s for persona, caregiver and dementia; `Tabs` filter by age band. One metric: "20 patients · 80 touchpoints · avg reading grade 11.8 → 5.6" (labeled *measured on cached output*).
2. **Patient context** (`/patient/[id]`):
   - Left: EHR snapshot (`Accordion` of encounters, `ScrollArea` for notes).
   - Right: check-in `Textarea` (prefilled), audience `Select`, language `Select`.
   - Primary `Button`: "Build Persona".
3. **Processing:** a 4-step list with `Skeleton` cards and stage `Badge`s. Each stage finishes into a visible partial (facts → profile → voice guide). No fake percentages.
4. **Result workspace:**
   - Top: Persona Profile card with fact / inferred / stated chips.
   - `Tabs`: Messages · Clinician Brief · Visit Summary · Video.
   - Right side: evidence `Sheet` and a Voice Guide `Accordion`.
   - Each touchpoint has Approve / Edit (`Dialog`) / Reject.
5. **Outbox and impact:** approved touchpoints, before → after metrics (reading grade, TI score, stigma terms removed, privacy rules enforced), a "Reset demo" button.

**Accessibility:**

- Labels on every input.
- Badges use icon plus text, never color alone.
- The summary meets WCAG AA contrast.
- Video has captions burned into the cards.
- Large type for the presentation screen.

**Design direction:**

- Calm, warm clinical look: off-white background with one deep teal accent.
- Patient-facing outputs (summary and video) share their own softer palette and rounded type, so they read as a different "voice" from the staff console.

---

## 8. Architecture

**Stack:**

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- React Hook Form + Zod, Lucide, Sonner
- Claude API, called server-side
- TTS: OpenAI or ElevenLabs, with cached MP3s
- `remotion` + `@remotion/player`
- `text-readability`-style FK grade calculated in TypeScript
- Deploy on Vercel

```text
app/
  page.tsx                      # cohort board
  patient/[id]/page.tsx         # context + build + result workspace
  outbox/page.tsx               # approvals + impact
  api/persona/route.ts          # POST {patientId, checkin, overrides} → {profile, voiceGuide, outputs, scores, meta}
  api/tts/route.ts              # text → mp3 (cached by hash)
components/
  cohort-grid.tsx  ehr-snapshot.tsx  pipeline-steps.tsx  persona-card.tsx
  message-compare.tsx  clinician-brief.tsx  visit-summary.tsx  evidence-sheet.tsx
  video-player.tsx  outbox.tsx  reset-demo-button.tsx  ui/…
remotion/
  VisitVideo.tsx  scenes/{Title,Card,Steps,Choice,Closing}.tsx   # props = videoScript + palette
lib/
  ai/{provider.ts, prompts.ts, schemas.ts}
  pipeline/{extract-facts.ts, build-profile.ts, voice-guide.ts, render.ts}
  ti-checker/{rules.ts, lexicon.ts, readability.ts, score.ts}
  data/{cohort.json, generated/<id>.json, audio/<hash>.mp3}
scripts/precompute.ts           # runs all 20 patients → generated/*.json + audio
```

**Fallback chain:**

1. Live LLM call (8 s timeout per stage)
2. Retry once on Zod failure
3. Cached `generated/<id>.json`, shown with a "Cached output" badge
4. Never crash

TTS follows the same chain: cached MP3, then a silent player with captions.

**Real vs. simulated:**

- **Real:** the EHR is the dataset as-is; the LLM generation is live; the TI scoring is real.
- **Simulated:** names, visits, check-ins and sending.

---

## 9. AI behavior

**System prompt (profile stage):**

> You are a patient-communication specialist trained in SAMHSA's trauma-informed principles, helping a clinic care team. From the supplied EHR facts and the patient's own check-in, produce a PersonaProfile JSON. Rules:
>
> - Use only the supplied data.
> - Tag every claim as `fact` (with source field / encounter), `inferred` (with a reason) or `patient_stated`.
> - Never infer language, religion or values from race, ethnicity or insurance.
> - Never infer cognitive status beyond documented diagnoses.
> - Flag contradictions in the record as `dataQualityWarnings`.
> - For dementia or caregiver audiences, address the patient with dignity and co-address the named caregiver.
> - For dual teen/guardian audiences, set privacy rules for confidential care.
> - Output must match the schema.

The render stage receives only the PersonaProfile, the VoiceGuide and the cited facts, never the raw note. This limits hallucination and keeps every claim citable.

**Human review:**

- Every output is editable.
- Inferred claims need a click to confirm.
- Privacy-rule hits block approval until resolved.

---

## 10. Demo scenarios

| Role | Patient | Why it lands | Talking point |
|---|---|---|---|
| Ideal | **1672 Emily** (PPCM, twins, anxiety) | Generic "appt in 2 days" vs. a step-by-step, choice-offering message; video previews the echo | "Same EHR, same clinic: the message now answers the question she'd lie awake with." |
| Complex | **2311 Walter** (moderate Alzheimer's, post-ICU delirium) | Messages go to the daughter, the morning slot is suggested, Walter is addressed with dignity; the clinician brief says "best in mornings, gets confused in new rooms" | "Dementia care is caregiver care." |
| Edge | **2544 Jake** (OUD) | The checker catches "drug-seeking / abuse" in the generic template; the rewrite uses person-first recovery language | "The checker is rules, not vibes, and it shows its work." |

---

## 11. Build sequence and checkpoints (Fri 8 PM → Sat 2 PM)

**Phase 0 — Decision and setup (Fri 8–9 PM)**

- [x] Inputs gathered, options scored, A selected / C backup
- [x] 20-patient cohort extracted (`cohort.json`)
- [ ] Recruit clinician: validate the stigma lexicon, the dementia personas and the brief format
- [ ] `create-next-app`, shadcn init, add card/badge/button/tabs/sheet/accordion/dialog/skeleton/sonner
- [ ] Env: `ANTHROPIC_API_KEY`, `TTS_API_KEY`
- **Exit:** 60-second explanation rehearsed with the clinician.
- **Checkpoint 1 — Concept Lock, 9 PM.**

**Phase 1 — Static vertical slice (Fri 9 PM → Sat 12:30 AM)**

- [ ] Cohort board, patient context, processing steps, result tabs, outbox
- [ ] Hand-write `generated/1672.json`; all tabs render from it, including a Remotion composition with static props
- **Exit:** full click-through for Emily with no APIs.
- **Checkpoint 2 — Static Demo, 12:30 AM.**

**Phase 2 — Core intelligence (Sat 12:30 AM → 3 AM, then 7 → 9 AM)**

- [ ] Zod schemas, prompts, provider adapter, 4-stage orchestration
- [ ] TI checker with unit tests
- [ ] TTS route
- [ ] Run `precompute.ts` for all 20 overnight
- [ ] Live call wired to the UI with the fallback badge
- **Exit:** Emily, Walter and Jake work live and cached.
- **Checkpoint 3 — Live Capability, 9 AM.**

**Phase 3 — Polish (Sat 9 AM → 12 PM)**

- [ ] Evidence sheet, edit dialog, privacy-block behavior, summary print styles, video palette
- [ ] Spanish example (should-have)
- [ ] Presentation-viewport pass, keyboard / labels check
- **Exit:** no broken states on the demo path.

**Phase 4 — Demo prep (Sat 12 → 2 PM)**

- [ ] Deploy and test in production
- [ ] Record a backup screen capture; pre-render MP4s for the 3 demo cases
- [ ] README; architecture diagram (built as an in-app "How it works" panel, since no slides are allowed)
- [ ] Rehearse ×3: fresh browser, slow network, API key removed
- **Checkpoint 4 — Demo Lock, 1 PM:** fix defects and copy only.

**Cut order if behind:**

1. Spanish
2. Teen split view
3. Live TTS (use cached audio)
4. Video tab (show the storyboard cards only)
5. → Backup C

---

## 12. Demo story (~3:30, all live, no slides)

- **0:00–0:20 Problem.** Clinician teammate reads the generic reminder aloud. "This is what David gets, whether he's 9, 29 in recovery, or 75 with Alzheimer's."
- **0:20–0:35 Product.** Cohort board: "Your chart says what's wrong. Off the Chart says how to talk to you. It turns the EHR into how each person needs to be spoken to."
- **0:35–2:00 Live.**
  - Emily: Build Persona; the stages fill in; Messages side by side with the score going from 38 to 91.
  - Play 20 s of the "before your visit" video.
  - Clinician Brief read aloud in 30 s.
  - Visit Summary.
- **2:00–2:30 Why AI.** Switch to Walter. The same pipeline addresses his daughter, suggests mornings and keeps his dignity. Rules alone can't synthesize an 8-encounter chart into this.
- **2:30–2:50 Trust.**
  - Open the evidence sheet: every claim cites its encounter.
  - "Inferred" badges.
  - Jake's template gets flagged for stigma terms.
  - The data-quality warning on a contradictory record.
- **2:50–3:10 Architecture.** In-app "How it works": EHR → Profile → Voice Guide → 4 renderers → checker → human approval. "It sits in front of any reminder vendor."
- **3:10–3:30 Impact.** Outbox metrics. "A pilot would measure no-shows and teach-back comprehension."

**Name callback:** close with "That's care that's off the chart."

**Judge moment:** the same chart rendered for Emily, then Walter, with the generic message's score jumping live and the dementia version addressing his daughter by name.

---

## 13. Likely judge questions

- **Why AI?** Turning a multi-encounter chart plus a free-text check-in into a communication profile is synthesis. Scoring and enforcement are deterministic rules on purpose.
- **Reliability?**
  - Zod schemas; the render stage sees only cited facts.
  - Every claim is sourced; guesses are labeled.
  - The rule-based checker; human approval; cached fallback.
- **Real vs. simulated?** The EHR and generation are real (synthetic dataset). Names, visits, check-ins and sending are simulated, and the UI labels them.
- **Who adopts?** Ambulatory practice managers and patient-experience leaders, plus reminder and AI-scribe vendors as an API layer. Value shows up in no-show rates and patient-experience scores.
- **Next tests:**
  - Product: do patients prefer it?
  - Technical: does it stay accurate on real notes?
  - Adoption: will clinic staff approve messages in bulk?
- **Different?** Most tools personalize by mail-merge or translate. Off the Chart personalizes by *audience, privacy and trauma-informed principles*, with evidence.
- **Scale?** Profiles are computed once per patient and refreshed per encounter. Renderers are cheap; video is client-side Remotion; TTS is cached.

---

## 14. Acceptance (Demo Lock gate)

- [ ] Purpose clear within 10 s on the cohort board
- [ ] ≤ 5 major steps from patient to approved outbox
- [ ] Live, cached and synthetic labels visible
- [ ] Production build, typecheck and TI-checker tests pass
- [ ] Pulling the API key → cached outputs, no crash
- [ ] Reset restores Emily as the start state
- [ ] Backup recording exists

## 15. README (at submission)

The README covers 14 items: pitch, problem, user, solution, demo link, GIF, architecture, stack, setup, env vars (`ANTHROPIC_API_KEY`, `TTS_API_KEY`), demo scenarios (Emily / Walter / Jake), limitations (synthetic data, simulated sending), roadmap (§6), and team.
