import Link from "next/link";
import { ArrowDownIcon, CheckCircle2Icon, CpuIcon, DatabaseIcon, ShieldCheckIcon, SlidersHorizontalIcon, UserCheckIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { demoEnabled } from "@/lib/namespace";

export const metadata = { title: "How it works" };

const STAGES = [
  { n: 1, title: "EHR record", who: "Data", icon: DatabaseIcon, text: "Diagnoses, medications, allergies and every encounter note. Here: a synthetic hospital dataset. In production: FHIR Patient, Condition, Encounter and DocumentReference." },
  { n: 2, title: "Extract facts", who: "Rules", icon: SlidersHorizontalIcon, text: "Deterministic. Each fact gets an id, a field and an encounter. Chart contradictions become staff-only warnings." },
  { n: 3, title: "Persona Profile", who: "Model, schema-checked", icon: CpuIcon, text: "Audience, reading level, emotional context, privacy rules, cognitive support, avoid-terms. Every claim cites fact ids and is tagged fact, inferred or patient-stated." },
  { n: 4, title: "Voice Guide", who: "Model, schema-checked", icon: CpuIcon, text: "Tone, do-say and don't-say, sentence limit, greeting and sign-off, choice and safety phrases. Decided once per person, enforced on every output." },
  { n: 5, title: "Four renderers", who: "Model, schema-checked", icon: CpuIcon, text: "Messages at three moments, the clinician brief, the visit summary and two video scripts. The render stage sees the profile, the guide and cited facts. Never the raw note." },
  { n: 6, title: "Trauma-informed checker", who: "Rules", icon: ShieldCheckIcon, text: "Eight rules, 100 points: reading grade, stigma lexicon with replacements, privacy (blocking), choice, predictability, safety, collaboration, sentence length. Same rules on the generic template and the Persona version." },
  { n: 7, title: "Human approval", who: "You", icon: UserCheckIcon, text: "Approve, edit or reject each touchpoint. Inferred claims need a click to confirm. A privacy hit blocks approval until the text is fixed. Then it goes to the outbox." },
];

export default function HowItWorksPage() {
  return (
    <div className="space-y-6">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal">Architecture</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-semibold">How it works</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        One engine, four outputs. The model does the synthesis a template can&apos;t; rules do the scoring and the enforcement; a person approves. It sits in front of any reminder vendor or portal as middleware.
      </p>

      <ol className="mt-8 grid gap-2" data-demo="architecture" aria-label="Pipeline">
        {STAGES.map((s, i) => {
          const Icon = s.icon;
          const model = s.who.startsWith("Model");
          return (
            <li key={s.n} className="grid gap-2">
              <Card className={`grid gap-1 p-4 sm:grid-cols-[auto_1fr] sm:gap-4 ${model ? "border-teal/40" : ""}`}>
                <div className="flex items-center gap-2 sm:w-44">
                  <span className="flex size-8 items-center justify-center rounded-full bg-muted font-heading tabular-nums">{s.n}</span>
                  <Icon aria-hidden className={`size-4 ${model ? "text-teal" : "text-muted-foreground"}`} />
                  <span className="text-xs text-muted-foreground">{s.who}</span>
                </div>
                <div>
                  <h2 className="text-base font-semibold font-sans">{s.title}</h2>
                  <p className="text-sm text-muted-foreground">{s.text}</p>
                </div>
              </Card>
              {i < STAGES.length - 1 && <ArrowDownIcon aria-hidden className="mx-auto size-4 text-muted-foreground/60" />}
            </li>
          );
        })}
      </ol>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <Card className="gap-2 p-5">
          <h2 className="text-lg font-semibold">Fallback chain</h2>
          <ol className="grid gap-1 text-sm">
            <li className="flex gap-2">
              <CheckCircle2Icon aria-hidden className="mt-0.5 size-4 text-teal" /> Live model call, schema-validated, one retry on a schema miss.
            </li>
            <li className="flex gap-2">
              <CheckCircle2Icon aria-hidden className="mt-0.5 size-4 text-teal" /> Cached precomputed output for that patient, labeled &ldquo;Cached output&rdquo;.
            </li>
            <li className="flex gap-2">
              <CheckCircle2Icon aria-hidden className="mt-0.5 size-4 text-teal" /> Rules-based templates, labeled &ldquo;Rules-based fallback&rdquo;.
            </li>
            <li className="flex gap-2">
              <CheckCircle2Icon aria-hidden className="mt-0.5 size-4 text-teal" /> Never a blank screen. Pull the API key and the app still works.
            </li>
          </ol>
        </Card>
        <Card className="gap-2 p-5">
          <h2 className="text-lg font-semibold">Real vs simulated</h2>
          <dl className="grid gap-1 text-sm">
            <div>
              <dt className="inline font-medium">Real: </dt>
              <dd className="inline text-muted-foreground">the EHR records (synthetic dataset, used as-is), the model generation, the scoring, the approval state.</dd>
            </div>
            <div>
              <dt className="inline font-medium">Simulated: </dt>
              <dd className="inline text-muted-foreground">names, upcoming visits, caregivers, check-ins, and sending. The outbox is a queue, not a gateway.</dd>
            </div>
            <div>
              <dt className="inline font-medium">Not claimed: </dt>
              <dd className="inline text-muted-foreground">clinical validation or regulatory compliance. A pilot would measure no-shows, portal engagement and teach-back comprehension.</dd>
            </div>
          </dl>
        </Card>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <Card className="gap-2 p-5">
          <h2 className="text-lg font-semibold">Why AI here</h2>
          <p className="text-sm text-muted-foreground">Turning an eight-encounter chart plus a free-text check-in into a communication profile is synthesis. A mail-merge can&apos;t do it. Scoring and enforcement are deterministic on purpose, so the system can show its work.</p>
        </Card>
        <Card className="gap-2 p-5">
          <h2 className="text-lg font-semibold">Where it plugs in</h2>
          <p className="text-sm text-muted-foreground">Profiles are computed once per patient and refreshed per encounter. Renderers are cheap. Video is client-side. Integration points: FHIR Communication and Appointment in front of existing reminder vendors, and a patient-facing check-in so people can edit their own persona.</p>
        </Card>
      </section>

      <div className="mt-10 flex flex-wrap gap-2">
        {demoEnabled() && (
          <Button asChild>
            <Link href="/demo">Run the guided walkthrough</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/rewrite">Try the rewrite tool</Link>
        </Button>
      </div>
    </div>
  );
}
