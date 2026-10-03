import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightIcon, FileTextIcon, ListChecksIcon, SendIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shell/wordmark";
import { currentUser } from "@/lib/auth";

const STEPS = [
  { Icon: FileTextIcon, title: "Pick a patient", body: "Their chart and their own 'what matters to you' check-in become a Persona Profile and a Voice Guide." },
  { Icon: ListChecksIcon, title: "Review the touchpoints", body: "Messages, the visit summary, a prep video and the clinician brief, each scored by the same rules and cited to the record." },
  { Icon: SendIcon, title: "Approve, then send", body: "A clinician approves. Privacy rules are enforced at approval and again at send. Every decision is on record." },
];

export default async function Home() {
  if (await currentUser()) redirect("/patients");
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-8 md:py-12">
      <header className="flex items-center justify-between">
        <Wordmark />
        <Badge variant="outline" className="h-6 px-2.5 text-xs">
          Synthetic patients only
        </Badge>
      </header>
      <main className="flex flex-1 flex-col justify-center gap-14 py-16">
        <section className="max-w-2xl space-y-6">
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl">
            Your chart says what&apos;s wrong. <span className="text-teal">Off the Chart</span> says how to talk to you.
          </h1>
          <p className="text-xl leading-relaxed text-foreground/85">
            Every automated patient touchpoint, written for the person reading it: trauma-informed, at their reading level, with privacy rules enforced and a clinician&apos;s approval before anything goes out.
          </p>
          <Button asChild size="lg" className="h-11 px-5 text-base">
            <Link href="/login">
              Sign in <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        </section>
        <section aria-labelledby="how">
          <h2 id="how" className="mb-4 font-sans text-sm font-medium uppercase tracking-wider text-muted-foreground">
            How it works
          </h2>
          <ol className="grid gap-6 border-t pt-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-heading text-2xl text-muted-foreground">{i + 1}</span>
                  <s.Icon className="size-4 text-muted-foreground" aria-hidden />
                </div>
                <h3 className="font-sans text-lg font-semibold">{s.title}</h3>
                <p className="text-base text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer className="text-xs text-muted-foreground">EHR records from sparkcpark/synthetic_hospital (MIT). Names, visits, check-ins and sending are simulated.</footer>
    </div>
  );
}
