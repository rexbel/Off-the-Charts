# Off the Chart: Full-App Build Plan

Status: draft for approval · 2026-10-03 · Owner: Rex Belgarde
Supersedes: `BUILD_PLAN.md` (the hackathon plan). Starting point: branch `feat/core-app`, commit `9cc0f66`.

## 1. Outcome

**Product.** A clinic care coordinator opens a patient with an upcoming visit, reviews what the patient said matters, builds a Persona, and sends a clinician the touchpoints to approve. Every outbound message, the visit summary, the prep video and the 30-second brief are person-specific, trauma-informed, evidence-linked, and approved by a human before they leave.

One user, one trigger, one outcome: *a visit is scheduled → the care team approves communications written for that person, at template speed.*

**Demo mode.** A presenter clicks "Run the demo" and a 14-step guided walkthrough replays precomputed output for Emily, Walter and Jake, isolated from real runs, with a one-click reset.

## 2. What carries over from the hackathon plan

| Keep | Why |
| --- | --- |
| Problem statement, primary user, three required proofs (§2) | Still the product thesis |
| 20-patient synthetic cohort and seed layer (§5), data-quality warnings shown not hidden | Already implemented in `src/lib/data/cohort.json` and `extract-facts.ts` |
| Pipeline and contracts: facts → PersonaProfile → VoiceGuide → renderers → checker (§6) | Implemented in `src/lib/schemas.ts` and `src/lib/pipeline/`; the schema is the product's spine |
| Trauma-informed checker as deterministic rules (§6) | Implemented, 42 tests; "rules, not vibes" is the trust story |
| AI behavior rules: cite every claim, label guesses, never infer from race/insurance, render stage never sees the raw note (§9) | Implemented in `src/lib/ai/prompts.ts` and `provider.ts` |
| Fallback chain live → cached → rules, never crash (§8) | Implemented in `run.ts`; cached files still need generating |
| Human review: edit, confirm inferred, privacy hits block approval (§9) | Implemented in `services/touchpoints.ts` |
| Demo story and three demo cases (§10, §12) | Became `src/components/demo/steps.ts`; stays as a feature |
| Judge questions (§13) | Become the README's "Why AI / Reliability / Real vs simulated" section |

| Drop | Why |
| --- | --- |
| Time boxes, checkpoints, cut order (§11) | Hackathon constraints |
| "No auth, no RBAC" non-goal (§6) | A clinic product needs roles; see Phase 2 |
| Precompute "overnight" as a one-off | Becomes a repeatable script with a CI option |
| Single-tenant assumptions (one clinic, one coordinator) | v1 stays single-clinic but models users, see Open decision 1 |
| Server-side TTS "OpenAI or ElevenLabs" | Deferred; browser speech ships (Open decision 4) |

## 3. Product scope v1

**Must**
- Persistent runs and history per patient (exists; add run comparison and "latest approved" marker).
- Patient check-in intake: a patient-facing, token-linked form ("What matters to you?", language, who to include, best time) that feeds the profile as `patient_stated` claims.
- Roles and approval queue: coordinator prepares and edits; clinician approves; an "Needs clinician" queue across patients.
- Privacy-rule enforcement at approval time (exists) plus enforcement at send time in the outbox.
- Audit trail with no message or note text (exists; add a viewable audit page per patient).
- Cached-output precompute script (exists) plus a committed cache for all 20 patients and a `pnpm precompute --check` that fails CI when the cache is stale against the schema.
- Guided demo behind a feature flag, with its own reset that never touches real runs.
- Working live model path with a configured key, labeled live/cached/fallback everywhere.

**Should**
- Spanish rendering verified for 2696 and 2848 with a Spanish-speaking reviewer.
- Teen/guardian split view (two recipients, two message sets) for 2883 and 2438.
- Printable visit summary with clinic header; copy to clipboard (exists).
- Rewrite-any-message tool (exists) with a history of rewrites per patient.
- Run comparison: diff two runs' messages side by side.

**Later**
- FHIR Communication/Appointment integration (section 6).
- Server-side TTS and MP4 export for videos.
- Patient-editable persona (patient portal view of their own profile).
- Multi-clinic tenancy; SSO.
- Analytics on no-show and teach-back outcomes.

## 4. Non-goals for v1

- Sending real SMS, email or portal messages. The outbox is a queue with a vendor adapter interface, not a gateway.
- HIPAA infrastructure, BAAs, or any real patient data. Synthetic cohort only.
- Clinical decision support. The brief summarizes how to talk to a person, never what to prescribe.
- Native mobile apps. Responsive web only.
- More than two languages.
- Generative avatars or server-rendered video.

## 5. Architecture

### Data model changes (reviewable; do not apply until Phase 2 is approved)

```ts
// src/db/schema.ts additions
users: { id, email, name, role: "coordinator" | "clinician" | "admin", createdAt }
sessions: { id, userId, expiresAt }                       // cookie session, see Open decision 1
patient_checkins: { id, patientId, token, status: "sent" | "submitted" | "expired",
                    answers JSON (whatMatters, language, includeRole, bestTime), submittedAt }
// persona_runs: add approvedAt, approvedBy (user id), label ("latest approved")
// touchpoints: add preparedBy, approvedBy, sentAt (simulated), vendorRef
// audit_events: add actorId (user id); keep "no text" rule
outbox_deliveries: { id, touchpointId, channel, status: "queued" | "sent_simulated" | "blocked",
                     reason, at }
demo_namespaces: { id ("demo"), createdAt }                // demo runs carry namespace "demo"
```

`persona_runs` and `touchpoints` get a `namespace` column (`"live"` | `"demo"`). Every query filters by namespace; the demo reset deletes only `namespace = "demo"`.

### API routes (new or changed)

| Route | Request | Response | Notes |
| --- | --- | --- | --- |
| `POST /api/auth/login`, `/logout` | `{ email, password }` | `{ user }` | Seeded users; no self-signup |
| `GET /api/me` | | `{ user }` | Role for UI gating |
| `POST /api/patients/[id]/checkins` | `{}` | `{ token, url }` | Creates a check-in link |
| `GET/POST /api/checkin/[token]` | `{ answers }` | `{ status }` | Patient-facing, unauthenticated by token |
| `POST /api/patients/[id]/build` | `{ mode, context, namespace }` | NDJSON `BuildEvent` | Adds `namespace`; coordinator or above |
| `POST /api/touchpoints/[id]` | `{ action, text?, note? }` | `{ touchpoint, score }` | `approve` requires clinician; `edit` any role; 409 on privacy block |
| `GET /api/queue` | `?status=needs_clinician` | `{ items }` | Cross-patient approval queue |
| `POST /api/outbox/send` | `{ touchpointIds }` | `{ deliveries }` | Simulated send; re-checks privacy; 409 on block |
| `GET /api/audit?patientId=` | | `{ events }` | Ids and counts only |
| `POST /api/demo/reset` | | `{ cleared }` | Only `namespace = "demo"` |
| `GET /api/health` | | `{ modelAvailable, cachedPatients, cacheStale }` | Exists; add staleness |

Errors stay `{ error, details? }` with 400/401/403/404/409/500.

### Model calls and fallback order

Unchanged: profile, voice guide and render each call Claude (`claude-opus-5-5`, structured outputs, one schema retry), then cached file for that patient and audience/language, then rules. Add: `ANTHROPIC_API_KEY` read from env only; per-stage timeout 90 s; token usage logged to audit as numbers.

### Demo isolation

The demo starts by creating runs with `namespace: "demo"` in cached mode. The cohort board, outbox metrics and queue show the active namespace with a visible banner ("Demo data"). Reset deletes demo runs, touchpoints and contexts only. Demo mode is a feature flag (`OFF_THE_CHART_DEMO=1`) so production builds can hide the "Run the demo" entry.

## 6. Integration path (later phase)

Off the Chart sits in front of a reminder vendor or portal. Minimum contract:

- Inbound: FHIR `Appointment` (upcoming visit, department, reason), `Patient`, `Condition`, `MedicationStatement`, `DocumentReference` (notes). An adapter maps these onto `PatientRecord`, replacing `cohort.json` as the source.
- Outbound: approved touchpoints become FHIR `Communication` resources with `recipient`, `medium` (sms/portal), `payload.contentString`, and a `basedOn` link to the `Appointment`. A vendor adapter interface (`send(delivery) → { vendorRef }`) with a simulated implementation in v1.
- Profiles refresh per new `Encounter`; a changed profile invalidates unapproved touchpoints.

## 7. Phases

| Phase | Deliverables | Acceptance criteria (reviewer-checkable) | Commands that must pass |
| --- | --- | --- | --- |
| **1. Cache and live path** (Phase 0 of the product) | Committed `src/lib/data/generated/*.json` for all 20 patients; `precompute --check`; README rewrite; live build verified with a key | 1. With a valid key, Emily's build shows "Live model" on all three model stages. 2. With the key removed, the same build shows "Cached output" and no error. 3. `pnpm precompute --check` exits 0 on a fresh clone. 4. README explains setup, env vars, real vs simulated. | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` |
| **2. Users, roles, queue** | Login, seeded users, role gating, approval queue page, audit page, schema migration | 1. A coordinator sees Edit but not Approve; a clinician sees both. 2. `/queue` lists every pending touchpoint across patients with patient name and kind. 3. Audit page shows actor, action, time, no text. 4. Approving as coordinator via API returns 403. | same + `pnpm db:push` on a fresh DB |
| **3. Patient check-in intake** | Check-in link creation, patient-facing form (en/es), answers flow into context and profile as patient-stated | 1. Coordinator creates a link; the form opens without login. 2. Submitting fills the check-in on the patient page with a "Patient submitted" badge. 3. The next build cites the answers as patient-stated claims. 4. An expired token shows a plain-language message. | same |
| **4. Outbox send and privacy at send time** | Simulated send with delivery records, vendor adapter interface, send-time privacy re-check, "latest approved" run label | 1. Sending an approved message creates a delivery with status `sent_simulated`. 2. Editing a message to include a restricted term after approval blocks send with the reason shown. 3. Outbox metrics match the numbers on the cohort board. | same |
| **5. Demo isolation and feature flag** | Namespace column, demo banner, reset limited to demo data, flag to hide demo in production, walkthrough re-verified end to end | 1. Running the demo then resetting leaves real runs untouched (count before = after). 2. With the flag off, no demo entry appears and `/demo` returns 404. 3. Walkthrough completes all 14 steps on cached output with no model key. 4. Mobile width (375 px) shows no horizontal overflow on every step. | same |
| **6. Hardening and should-haves** | Spanish review, teen/guardian split, run comparison, rewrite history, accessibility pass, Vercel + Turso deploy | 1. Spanish messages for 2696 reviewed by a Spanish speaker, score ≥ 85. 2. 2883 shows two recipients with different content and the guardian copy has no mental-health terms. 3. Keyboard-only walk of the patient page reaches every action. 4. Deployed URL passes the Phase 1 checks. | same + deploy preview |

## 8. Open decisions

| # | Decision | Recommended default |
| --- | --- | --- |
| 1 | Auth approach | Cookie sessions with seeded users and bcrypt passwords (same pattern as Greenlight); no SSO in v1 |
| 2 | Database for deploy | libsql: SQLite file locally, Turso in production via `DATABASE_URL`; schema is Postgres-portable later |
| 3 | Precompute in CI | Yes for `--check` (staleness only, no model calls); full regeneration stays manual with a key |
| 4 | TTS | Browser speech in v1, labeled "Browser voice"; add server TTS only if a reviewer flags quality |
| 5 | Demo in production builds | Shipped behind `OFF_THE_CHART_DEMO`, on in preview deploys, off in production |
| 6 | Model | `claude-opus-5-5` for all three stages; measure cost per build in Phase 1 and consider Sonnet for the voice guide stage if cost matters |
| 7 | Who can approve | Clinician only; coordinator can approve nothing, even with no clinician assigned |
| 8 | Check-in link delivery | Copy-link only in v1 (sending is simulated); no email/SMS send |

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| No model key on the build machine; cached files cannot be generated | Phase 1 blocks on a key; until then the rules fallback carries the demo and is labeled |
| Model output drifts from the schema | Zod validation plus one retry; `precompute --check` revalidates cached files |
| Role gating only in the UI | Enforce in route handlers (403) and test it in Phase 2 |
| Demo data pollutes real metrics | Namespace column and filtered queries from Phase 5; banner when demo namespace is active |
| Privacy term slips through an edit | Re-check at approval and at send; blocked status visible in both places |
| Stigma lexicon false positives (insurance "denied", "transient ischemic attack") | Lexicon guards exist; add a per-clinic allowlist in Phase 6 if needed |
| Reading-grade formulas misjudge SMS-style text | Readability tests exist; keep reviewing with the Spanish reviewer in Phase 6 |
