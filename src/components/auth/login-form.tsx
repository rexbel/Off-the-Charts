"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon, LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiRequestError } from "@/lib/client/api";
import { ROLE_LABEL, type Role } from "@/lib/schemas";

const ROLE_HINT: Record<Role, string> = { coordinator: "prepares and edits", clinician: "approves and sends", admin: "does both" };

/**
 * Email + password against the seeded staff accounts. Outside production the
 * quick-fill buttons set both fields so a reviewer can switch roles in one
 * click; Enter submits either way. On a public demo (quickSignin) the buttons
 * sign straight in through the server, so no password reaches the browser.
 */
export function LoginForm({ quickFill, seedPassword, quickSignin = false }: { quickFill: { email: string; name: string; role: Role }[]; seedPassword: string | null; quickSignin?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(seedPassword ? (quickFill[0]?.email ?? "") : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) {
      setError(!email.trim() ? "Enter your work email." : "Enter your password.");
      (!email.trim() ? emailRef : passwordRef).current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.login({ email, password });
      router.push("/patients");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError && err.status !== 500 ? err.message : "Could not sign in. Check the email and password and try again.");
      setBusy(false);
      passwordRef.current?.focus();
      return;
    }
    // Stay busy while the console loads so the button cannot be pressed twice.
  };

  const quick = async (u: { email: string }) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.quickLogin(u.email);
      router.push("/patients");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError && err.status !== 500 ? err.message : "Could not sign in. Try again.");
      setBusy(false);
    }
  };

  const fill = (u: { email: string }) => {
    if (quickSignin) return void quick(u);
    if (!seedPassword) return;
    setEmail(u.email);
    setPassword(seedPassword);
    setError(null);
    submitRef.current?.focus();
  };

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4" noValidate aria-describedby={error ? "login-error" : undefined}>
      <div className="grid gap-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input ref={emailRef} id="email" name="email" type="email" inputMode="email" autoComplete="username" autoFocus={!email} value={email} onChange={(e) => setEmail(e.target.value)} required aria-invalid={error ? true : undefined} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input ref={passwordRef} id="password" name="password" type="password" autoComplete="current-password" autoFocus={Boolean(email)} value={password} onChange={(e) => setPassword(e.target.value)} required aria-invalid={error ? true : undefined} />
      </div>
      {error && (
        <p id="login-error" role="alert" className="flex items-start gap-1.5 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      <Button ref={submitRef} type="submit" size="lg" disabled={busy}>
        {busy ? <Loader2Icon aria-hidden className="animate-spin" /> : <LogInIcon aria-hidden />} {busy ? "Signing in…" : "Sign in"}
      </Button>
      {quickFill.length > 0 && (seedPassword || quickSignin) && (
        <fieldset className="rounded-lg border border-dashed p-3">
          <legend className="px-1 text-xs font-medium text-muted-foreground">{quickSignin ? "Demo accounts" : "Development accounts"}</legend>
          <p className="text-xs text-muted-foreground">
            {quickSignin ? "Seeded, synthetic staff. Pick one to sign in." : "Seeded, synthetic staff. Pick one to fill both fields, then press Sign in."}
          </p>
          <ul className="mt-2 grid gap-1.5" role="list">
            {quickFill.map((u) => (
              <li key={u.email}>
                <button
                  type="button"
                  onClick={() => fill(u)}
                  disabled={busy}
                  aria-label={`${quickSignin ? "Sign in as" : "Fill in"} ${u.name}, ${ROLE_LABEL[u.role]}`}
                  className="flex w-full items-baseline justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-left text-sm transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="font-medium">{u.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABEL[u.role]} <span aria-hidden>·</span> {ROLE_HINT[u.role]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </form>
  );
}
