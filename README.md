# Off the Chart

**Your chart says what's wrong. Off the Chart says how to talk to you.**

Off the Chart is a care-team console that turns a patient's EHR and their own "What matters to you?" check-in into a **Persona Profile** and a **Voice Guide**, then renders every automated touchpoint for that person: appointment messages at three moments, a plain-language visit summary, a captioned prep video, and a 30-second clinician brief. A deterministic trauma-informed checker scores the clinic's current template and the new version with the same rules, every claim cites its source in the record, guesses are labeled, and a clinician approves before anything goes out.

**Every patient, note, visit, user and message in this repository is synthetic.** The EHR records come from [sparkcpark/synthetic_hospital](https://huggingface.co/datasets/sparkcpark/synthetic_hospital) (MIT). Names, caregivers, upcoming visits and check-ins are seeded. Sending is simulated.

## What it does

1. **Cohort board.** Twenty synthetic patients, ages 3 to 75, each with an upcoming visit and badges for who the messages go to (patient, caregiver, teen and guardian, several caregivers).
2. **Patient workspace.** The EHR snapshot on the left, the patient-stated check-in, audience, language and channel on the right. **Build Persona** runs four visible stages: extract facts (rules), Persona Profile (model), Voice Guide (model), render (model), then check and score (rules).
3. **Review.** Messages side by side with today's template, each scored 0 to 100 with the reasons. Clinician brief with read-aloud. Visit summary in the patient's voice, printable. Before/after visit video rendered in the browser. Every claim chip opens an evidence sheet pointing at the encounter and field; inferred claims need a click to confirm; a privacy hit blocks approval.
4. **Approve and send.** Coordinators prepare and edit, clinicians approve. Approved items land in the outbox, where sending is simulated and privacy is re-checked at send time. An audit trail records who did what, with ids and counts only.
5. **Guided demo.** A 14-step walkthrough (Emily, Walter, Jake, Grace) that replays cached output in its own data namespace, with a reset that never touches real work.

## Stack

Next.js 16 (App Router), TypeScript, Tailwind v4, shadcn/ui, Drizzle on libsql (SQLite locally, Turso-compatible), Remotion player, Zod, Vitest. Models: Claude (`@anthropic-ai/sdk`, structured outputs) or OpenAI (chat completions with JSON schema) behind one adapter. Everything else is rules.

## Setup

Requires Node 22 and pnpm.

```bash
pnpm install
cp .env.example .env.local   # then set one model key (optional)
pnpm dev
```

Open http://localhost:3000 and sign in with a seeded development account from the quick-fill buttons (coordinator, clinician, admin). The SQLite database is created and migrated on the first request.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude. Preferred when set. Default model `claude-opus-5-5`. |
| `OPENAI_API_KEY` | OpenAI, used when no Anthropic credential is set. Default model `gpt-4.1` (`OPENAI_MODEL` to override). |
| `OFF_THE_CHART_PROVIDER` | Force `anthropic` or `openai` when both keys exist. |
| `OFF_THE_CHART_STAGE_TIMEOUT_MS` | Per-stage model timeout (default 90000). |
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN` | libsql URL (default `file:data/offthechart.db`); Turso in production. |
| `SEED_PASSWORD` | Password for the seeded staff accounts. Defaults to a dev value outside production; required in production. |
| `OFF_THE_CHART_DEMO` | `1`/`0` to force the guided demo on or off. Default: on outside production. |

Without a model key the app still works: builds use cached output when a precomputed file exists for that patient, otherwise the rules-based fallback, and the UI labels both.

### Commands

```bash
pnpm dev            # dev server
pnpm build          # production build
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm test           # vitest (checker, pipeline helpers)
pnpm precompute     # generate src/lib/data/generated/<id>.json for all 20 patients (needs a model key)
pnpm precompute --check   # fail if cached files are missing or no longer match the schema (no model calls)
pnpm db:push        # apply schema with drizzle-kit (migrations also run automatically)
```

## Real vs simulated

| Real | Simulated |
| --- | --- |
| The EHR records (synthetic dataset, used as-is) | Names, caregivers, upcoming visits, check-ins |
| Model generation and schema validation | Sending: the outbox writes delivery records, nothing leaves |
| The trauma-informed scoring, approval state, audit | Staff accounts (seeded) |
| Browser speech for read-aloud and video voice | Studio TTS and MP4 export (not built) |

Not claimed: clinical validation or regulatory compliance. A pilot would measure no-shows, portal engagement and teach-back comprehension.

## How the engine works

```
EHR record ─► extract facts (rules) ─► Persona Profile (model, schema-checked)
           ─► Voice Guide (model) ─► 4 renderers (model) ─► TI checker (rules) ─► human approval
```

- The render stage sees only the profile, the voice guide and cited facts, never the raw note.
- Fallback chain per model stage: live call (one retry on a schema miss) → cached output for that patient → rules-based templates. Never a blank screen.
- The checker allocates 100 points across eight rules: privacy (blocking), stigma lexicon with replacements, reading grade (Flesch-Kincaid, Fernández-Huerta for Spanish), sentence length, choice, predictability, safety, collaboration. Details in `src/lib/ti-checker/score.ts`.

## Demo scenarios

| Role | Patient | What lands |
| --- | --- | --- |
| Ideal | Emily (32, peripartum cardiomyopathy, twins) | Generic "appt in 2 days" vs a step-by-step, choice-offering message; score jumps |
| Complex | Walter (75, Alzheimer's, post-ICU delirium) | Messages go to his daughter, mornings suggested, Walter named with dignity |
| Edge | Jake (29, in recovery) | The checker flags stigma terms in the template; the rewrite is person-first and the privacy rule keeps the diagnosis out of texts |
| Chart check | Grace (66) | A contradictory record is flagged to staff and never repeated to her |

## Roadmap

See `docs/PLAN.md`. Next: FHIR Communication/Appointment integration in front of reminder vendors, a patient-editable persona, and outcome measurement.

## License

MIT. See `LICENSE`.
