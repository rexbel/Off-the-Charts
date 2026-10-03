"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CpuIcon, DatabaseIcon, LogOutIcon, MenuIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Wordmark } from "./wordmark";
import { DemoBar } from "@/components/demo/demo-bar";
import { useDemo } from "@/components/demo/demo-provider";
import { api } from "@/lib/client/api";
import { ROLE_LABEL, type Namespace, type User } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export const ORG_NAME = "Riverbend Clinic (synthetic)";

const NAV = [
  { href: "/patients", label: "Patients" },
  { href: "/queue", label: "Queue" },
  { href: "/outbox", label: "Outbox" },
  { href: "/rewrite", label: "Rewrite" },
  { href: "/audit", label: "Audit" },
  { href: "/how-it-works", label: "How it works" },
] as const;

export function AppShell({ children, user, namespace, demoEnabled, modelAvailable, provider }: { children: React.ReactNode; user: User; namespace: Namespace; demoEnabled: boolean; modelAvailable: boolean; provider: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const demo = useDemo();
  const [signingOut, setSigningOut] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const nav = demoEnabled ? [...NAV, { href: "/demo", label: "Walkthrough" } as const] : NAV;

  const signOut = async () => {
    setSigningOut(true);
    try {
      await api.logout();
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Try again.");
      setSigningOut(false);
    }
  };

  const leaveDemo = async () => {
    await demo.exit();
    router.refresh();
  };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <header className="no-print sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-[1500px] items-center gap-6 px-4 md:px-6">
          <Wordmark />
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive(item.href) ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-4 md:flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn("inline-flex items-center gap-1 text-xs", modelAvailable ? "text-teal" : "text-muted-foreground")}>
                  {modelAvailable ? <CpuIcon aria-hidden className="size-3.5" /> : <DatabaseIcon aria-hidden className="size-3.5" />}
                  {modelAvailable ? `Model: ${provider}` : "Model: offline"}
                </span>
              </TooltipTrigger>
              <TooltipContent>{modelAvailable ? "A model key is configured. Builds run live, with cached and rules-based fallbacks." : "No model key configured. Builds use cached output where it exists, otherwise the rules-based fallback. Both are labeled."}</TooltipContent>
            </Tooltip>
            <div className="text-right leading-tight">
              <p className="text-sm font-medium">
                {user.name} <span className="font-normal text-muted-foreground">· {ROLE_LABEL[user.role]}</span>
              </p>
              <p className="text-xs text-muted-foreground">{ORG_NAME}</p>
            </div>
            <Button variant="outline" onClick={signOut} disabled={signingOut}>
              <LogOutIcon aria-hidden /> Sign out
            </Button>
          </div>
          <div className="ml-auto md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-lg" aria-label="Open menu">
                  <MenuIcon aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="space-y-0.5">
                  <span className="block text-sm font-medium text-foreground">
                    {user.name} · {ROLE_LABEL[user.role]}
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground">{ORG_NAME}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {nav.map((item) => (
                  <DropdownMenuItem key={item.href} asChild className="py-2 text-base">
                    <Link href={item.href}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signOut} className="py-2 text-base">
                  <LogOutIcon aria-hidden /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {namespace === "demo" && (
          <div role="status" className="border-t border-warn/40 bg-warn-soft/60 text-xs">
            <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-3 px-4 py-1.5 md:px-6">
              <span>
                <span className="font-medium">Demo workspace.</span> Runs, approvals and metrics shown here are separate from real work.
              </span>
              <button type="button" onClick={leaveDemo} className="underline underline-offset-2 hover:text-foreground">
                Back to live data
              </button>
            </div>
          </div>
        )}
      </header>
      <main id="main" className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
      <footer className="no-print border-t border-border/60 py-5 text-xs text-muted-foreground">
        <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-2 px-4 md:px-6">
          <span>Synthetic data only. Human approval before anything is sent.</span>
          <span>EHR from sparkcpark/synthetic_hospital (MIT). Names, visits, check-ins and sending are simulated.</span>
        </div>
      </footer>
      <DemoBar />
    </div>
  );
}
