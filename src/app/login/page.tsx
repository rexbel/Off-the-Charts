import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Wordmark } from "@/components/shell/wordmark";
import { currentUser, seedPassword, SEED_USERS } from "@/lib/auth";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  const quickFill = process.env.NODE_ENV !== "production" && seedPassword() ? SEED_USERS.map((u) => ({ email: u.email, name: u.name, role: u.role })) : [];
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <Wordmark size="lg" className="self-start" />
      <h1 className="mt-6 text-2xl font-semibold">Sign in to the care team console</h1>
      <p className="mt-1 text-sm text-muted-foreground">Staff accounts only. Every patient here is synthetic.</p>
      <LoginForm quickFill={quickFill} seedPassword={quickFill.length ? seedPassword() : null} />
    </div>
  );
}
