import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ClaimKindBadge } from "@/components/badges";
import { CheckinForm } from "@/components/checkin/checkin-form";
import { getPatient, DEMO_PATIENT_IDS } from "@/lib/data/cohort";
import { loadCachedRun } from "@/lib/pipeline/cached";
import { demoEnabled } from "@/lib/namespace";
import { backdropFor, backdropSrc } from "@/remotion/backdrops";
import type { CheckinInitial } from "@/components/checkin/checkin-form";

export const metadata = { title: "Emily's intake" };
export const dynamic = "force-dynamic";

/**
 * Walkthrough step: the patient check-in as Emily sees it (approved video,
 * then the question, her answer filled in), beside the Persona Profile claims
 * that come from that answer. Replays Emily's cached run; nothing is submitted.
 */
export default async function DemoIntakePage() {
  if (!demoEnabled()) notFound();
  const emily = getPatient(DEMO_PATIENT_IDS.ideal)!;
  const cached = await loadCachedRun(emily.patientId);
  const script = cached?.outputs.videoScripts.find((v) => v.stage === "before");
  const answer = cached?.context.checkin ?? emily.seed.whatMattersCheckin;
  const profile = cached?.profile;
  const stated = profile ? [...profile.emotionalContext, ...profile.cognitiveSupport, ...profile.strengths].filter((c) => c.kind === "patient_stated") : [];

  return (
    <div className="grid gap-6 pb-16 lg:grid-cols-[1.1fr_1fr]" data-demo="intake">
      <Card className="voice-surface gap-0 overflow-hidden p-0">
        <p className="border-b px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">What Emily sees · check-in link</p>
        <CheckinForm
          token="walkthrough"
          initial={previewInitial(emily.seed.preferredName)}
          video={script && profile ? { script, preferredName: profile.preferredName, language: "en", backdrop: backdropSrc(backdropFor(emily.seed.ageBand, profile.audience)) } : null}
          preview={{ answer }}
        />
      </Card>

      <Card className="gap-4 self-start p-5 sm:p-6 lg:sticky lg:top-20">
        <div>
          <h2 className="text-lg font-semibold">Where her words go</h2>
          <p className="text-sm text-muted-foreground">Her answer becomes patient-stated input. These lines on her Persona Profile come from it, and each one cites the check-in.</p>
        </div>
        <blockquote className="rounded-lg bg-stated-soft/50 p-3 font-voice text-base">&ldquo;{answer}&rdquo;</blockquote>
        <ul className="grid gap-3">
          {stated.map((c) => (
            <li key={c.id} className="grid gap-1">
              <ClaimKindBadge kind="patient_stated" className="w-fit" />
              <span className="text-sm">{c.text}</span>
            </li>
          ))}
        </ul>
        {stated.length === 0 && <p className="text-sm text-muted-foreground">No cached Persona Profile for Emily yet. Run pnpm precompute 1672.</p>}
      </Card>
    </div>
  );
}

/** A fresh, unexpired link for the preview. */
function previewInitial(firstName: string): CheckinInitial {
  return { kind: "ok", status: "sent", expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(), patientFirstName: firstName, language: "en" };
}
