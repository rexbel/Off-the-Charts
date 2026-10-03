import { DemoIntro } from "@/components/demo/demo-intro";
import { getPatient, DEMO_PATIENT_IDS } from "@/lib/data/cohort";
import { genericBaseline } from "@/lib/pipeline/generic-baseline";
import { scoreText } from "@/lib/ti-checker";
import { DEMO_STEPS } from "@/components/demo/steps";

export const metadata = { title: "Guided walkthrough" };
export const dynamic = "force-dynamic";

export default function DemoPage() {
  const emily = getPatient(DEMO_PATIENT_IDS.ideal)!;
  const generic = genericBaseline(emily).messages[1].text;
  const score = scoreText(generic, {
    readingLevel: 6,
    sentenceMaxWords: 12,
    language: "en",
    channel: "sms",
    recipient: "patient",
    privacyRules: [],
    avoidTerms: [],
  });
  return <DemoIntro genericText={generic} genericScore={score} steps={DEMO_STEPS.map((s) => ({ id: s.id, title: s.title }))} />;
}
