"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CpuIcon, DatabaseIcon, FlaskConicalIcon, MenuIcon, PlayIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Wordmark } from "./wordmark";
import { DemoBar } from "@/components/demo/demo-bar";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Patients" },
  { href: "/outbox", label: "Outbox" },
  { href: "/rewrite", label: "Rewrite" },
  { href: "/how-it-works", label: "How it works" },
] as const;

export function AppShell({ children, modelAvailable }: { children: React.ReactNode; modelAvailable: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/patients") : pathname.startsWith(href));

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
                  {modelAvailable ? "Model: live" : "Model: cached"}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {modelAvailable ? "Claude is configured. Builds run live, with cached and rules-based fallbacks." : "No model key configured. Builds use cached output or rules-based fallback and are labeled."}
              </TooltipContent>
            </Tooltip>
            <Button asChild size="sm" className="hidden sm:inline-flex" data-demo="start-demo">
              <Link href="/demo">
                <PlayIcon aria-hidden /> Run the demo
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" className="md:hidden" aria-label="Open menu">
                  <MenuIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {NAV.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem asChild>
                  <Link href="/demo">Run the demo</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
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
