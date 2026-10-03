import { CheckinForm, type CheckinInitial } from "@/components/checkin/checkin-form";
import { getPatient } from "@/lib/data/cohort";
import { checkinExtraQuestionsEnabled, getCheckinByToken } from "@/lib/services/checkins";
import { getContext } from "@/lib/services/context";

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
  if (!checkin || !patient) {
    initial = { kind: "invalid", language: "en" };
  } else {
    const { context } = await getContext(patient);
    initial = { kind: "ok", status: checkin.status, expiresAt: checkin.expiresAt, patientFirstName: patient.seed.preferredName, language: context.language };
  }

  return (
    <main className="voice-surface flex min-h-screen flex-1 flex-col">
      <CheckinForm token={token} initial={initial} extraQuestions={checkinExtraQuestionsEnabled()} />
    </main>
  );
}
