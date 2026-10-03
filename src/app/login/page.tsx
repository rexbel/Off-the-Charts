import { redirect } from "next/navigation";
import { CheckCircle2Icon, FlaskConicalIcon, type LucideIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { Wordmark } from "@/components/shell/wordmark";
import { currentUser, seedPassword, SEED_USERS } from "@/lib/auth";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const WHAT_IT_DOES: { icon: LucideIcon; text: string }[] = [
  { icon: SparklesIcon, text: "Turns a chart plus the patient's own words into a Persona Profile and Voice Guide." },
  { icon: ShieldCheckIcon, text: "Scores every reminder, summary, brief and video script against trauma-informed rules." },
  { icon: CheckCircle2Icon, text: "Nothing reaches a patient until a clinician approves it." },
];

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  // Quick-fill only when the built-in dev default is in use; a real SEED_PASSWORD never reaches the browser.
  const devDefault = process.env.NODE_ENV !== "production" && !process.env.SEED_PASSWORD ? seedPassword() : null;
  const quickFill = devDefault ? SEED_USERS.map((u) => ({ email: u.email, name: u.name, role: u.role })) : [];
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-20">
        <section aria-labelledby="login-intro">
          <Wordmark size="lg" className="self-start" />
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-teal">Care team console</p>
          <h1 id="login-intro" className="mt-2 text-3xl font-semibold leading-[1.1] text-balance sm:text-4xl">
            Your chart says what&apos;s wrong. <span className="text-teal">Off the Chart</span> says how to talk to you.
          </h1>
          <ul className="mt-6 grid gap-3 text-sm text-muted-foreground" role="list">
            {WHAT_IT_DOES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5">
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-teal" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="login-heading" className="rounded-xl border bg-card p-5 shadow-xs sm:p-7">
          <h2 id="login-heading" className="text-2xl font-semibold">
            Sign in
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Staff accounts only. Coordinators prepare and edit; clinicians approve and send.</p>
          <LoginForm quickFill={quickFill} seedPassword={devDefault} />
        </section>
      </main>
      <footer className="border-t border-border/60 py-5 text-xs text-muted-foreground">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 sm:px-6">
          <span className="inline-flex items-center gap-1.5">
            <FlaskConicalIcon aria-hidden className="size-3.5" /> Synthetic data only. Every patient, note and visit here is made up.
          </span>
          <span>Human approval before anything is sent.</span>
        </div>
      </footer>
    </div>
  );
}
