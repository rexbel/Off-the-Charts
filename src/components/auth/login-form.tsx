"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiRequestError } from "@/lib/client/api";
import { ROLE_LABEL, type Role } from "@/lib/schemas";

export function LoginForm({ quickFill, seedPassword }: { quickFill: { email: string; name: string; role: Role }[]; seedPassword: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState(quickFill[0]?.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login({ email, password });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not sign in. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4" aria-describedby={error ? "login-error" : undefined}>
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && (
        <p id="login-error" role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2Icon aria-hidden className="animate-spin" /> : <LogInIcon aria-hidden />} Sign in
      </Button>
      {quickFill.length > 0 && seedPassword && (
        <div className="rounded-lg border border-dashed p-3">
          <p className="text-xs text-muted-foreground">Development accounts (seeded, synthetic). Click to fill both fields.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {quickFill.map((u) => (
              <Button
                key={u.email}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmail(u.email);
                  setPassword(seedPassword);
                }}
              >
                {u.name} · {ROLE_LABEL[u.role]}
              </Button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
