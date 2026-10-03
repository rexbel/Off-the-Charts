import { CheckinForm, type CheckinInitial } from "@/components/checkin/checkin-form";
import { getPatient } from "@/lib/data/cohort";
import { checkinExtraQuestionsEnabled, getCheckinByToken } from "@/lib/services/checkins";
import { getContext } from "@/lib/services/context";
import { latestRunForPatient } from "@/lib/services/runs";
import { backdropFor, backdropSrc } from "@/remotion/backdrops";
import type { CheckinVideo } from "@/components/checkin/checkin-form";
import type { PatientRecord } from "@/lib/schemas";

export const metadata = { title: "Before your visit", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * Patient-facing check-in. No sign-in: the token in the URL is the only
 * credential. Lives outside the (console) group so the staff shell and auth
 * redirect never apply here.
 */
export default async function CheckinPage(props: PageProps<"/checkin/[token]">) {
  const { token } = await props.params;
  const checkin = TOKEN_SHAPE.test(token) ? await getCheckinByToken(token) : null;
  const patient = checkin ? getPatient(checkin.patientId) : undefined;

  let initial: CheckinInitial;
  let video: CheckinVideo | null = null;
  if (!checkin || !patient) {
    initial = { kind: "invalid", language: "en" };
  } else {
    const [{ context }, approvedVideo] = await Promise.all([getContext(patient), checkin.status === "sent" ? approvedBeforeVideo(patient) : null]);
    initial = { kind: "ok", status: checkin.status, expiresAt: checkin.expiresAt, patientFirstName: patient.seed.preferredName, language: context.language };
    video = approvedVideo;
  }

  return (
    <main className="voice-surface flex min-h-screen flex-1 flex-col">
      <CheckinForm token={token} initial={initial} extraQuestions={checkinExtraQuestionsEnabled()} video={video} />
    </main>
  );
}

/**
 * The "before your visit" video from the latest live run, only once a
 * clinician has approved it: nothing reaches the patient unapproved.
 */
async function approvedBeforeVideo(patient: PatientRecord): Promise<CheckinVideo | null> {
  const latest = await latestRunForPatient(patient.patientId);
  if (!latest) return null;
  const tp = latest.touchpoints.find((t) => t.kind === "video_before");
  if (!tp || (tp.status !== "approved" && tp.status !== "edited")) return null;
  const script = latest.run.outputs.videoScripts.find((v) => v.stage === "before");
  if (!script) return null;
  const { profile } = latest.run;
  return { script, preferredName: profile.preferredName, language: profile.communicationNeeds.language, backdrop: backdropSrc(backdropFor(patient.seed.ageBand, profile.audience)) };
}
