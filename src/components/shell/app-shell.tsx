"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CpuIcon, DatabaseIcon, FlaskConicalIcon, LogOutIcon, PlayIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Wordmark } from "./wordmark";
import { DemoBar } from "@/components/demo/demo-bar";
import { useDemo } from "@/components/demo/demo-provider";
import { api } from "@/lib/client/api";
import { ROLE_LABEL, type Namespace, type User } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Patients" },
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
  const isActive = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/patients") : pathname.startsWith(href));

  const logout = async () => {
    try {
      await api.logout();
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Try again.");
    }
  };

  const leaveDemo = async () => {
    await demo.exit();
    router.refresh();
  };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="no-print sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Wordmark />
          <nav aria-label="Primary" className="hidden md:flex items-center gap-1 ml-4">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive(item.href) && "text-foreground bg-muted",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="hidden lg:inline-flex gap-1 text-muted-foreground">
                  <FlaskConicalIcon aria-hidden /> Synthetic data
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Every patient, note and visit here is synthetic. No real people.</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={cn("hidden lg:inline-flex gap-1", modelAvailable ? "text-teal border-teal/40" : "text-warn border-warn/40")}>
                  {modelAvailable ? <CpuIcon aria-hidden /> : <DatabaseIcon aria-hidden />}
                  {modelAvailable ? `Model: live (${provider})` : "Model: cached"}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{modelAvailable ? "A model key is configured. Builds run live, with cached and rules-based fallbacks." : "No model key configured. Builds use cached output or rules-based fallback and are labeled."}</TooltipContent>
            </Tooltip>
            {demoEnabled && !demo.active && (
              <Button asChild size="sm" className="hidden sm:inline-flex" data-demo="start-demo">
                <Link href="/demo">
                  <PlayIcon aria-hidden /> Run the demo
                </Link>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label={`Signed in as ${user.name}, ${ROLE_LABEL[user.role]}`}>
                  <UserIcon aria-hidden /> <span className="hidden sm:inline">{user.name.split(" ")[0]}</span>
                  <span className="hidden md:inline text-muted-foreground">· {ROLE_LABEL[user.role]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {user.name}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {user.email} · {ROLE_LABEL[user.role]}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="md:hidden">
                  {NAV.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href}>{item.label}</Link>
                    </DropdownMenuItem>
                  ))}
                  {demoEnabled && (
                    <DropdownMenuItem asChild>
                      <Link href="/demo">Run the demo</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </div>
                <DropdownMenuItem onSelect={logout}>
                  <LogOutIcon aria-hidden /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {namespace === "demo" && (
          <div role="status" className="border-t border-warn/40 bg-warn-soft/60 text-xs">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-1.5 sm:px-6">
              <span>
                <span className="font-medium">Demo data.</span> Runs, approvals and metrics shown here live in the demo workspace, separate from real work.
              </span>
              <button type="button" onClick={leaveDemo} className="underline underline-offset-2 hover:text-foreground">
                Back to live data
              </button>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="no-print border-t border-border/60 py-6 text-xs text-muted-foreground">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 sm:px-6">
          <span>Off the Chart · Persona engine · Human approval before anything is sent.</span>
          <span>EHR from sparkcpark/synthetic_hospital (MIT). Names, visits, check-ins and sending are simulated.</span>
        </div>
      </footer>
      <DemoBar />
    </div>
  );
}
