"use client";

import { useState } from "react";
import { Loader2Icon, PillIcon, RotateCcwIcon, SparklesIcon, StethoscopeIcon, TriangleAlertIcon, DatabaseIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AUDIENCE_LABEL, audienceSchema, type BuildMode, type PatientContext, type PatientRecord } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export function ContextPanel({
  patient,
  context,
  edited,
  onChange,
  onReset,
  onBuild,
  building,
  hasRun,
  cachedAvailable,
  modelAvailable,
}: {
  patient: PatientRecord;
  context: PatientContext;
  edited: boolean;
  onChange: (c: PatientContext) => void;
  onReset: () => void;
  onBuild: (mode: BuildMode) => void;
  building: boolean;
  hasRun: boolean;
  cachedAvailable: boolean;
  modelAvailable: boolean;
}) {
  const { ehr, seed } = patient;
  const [openEnc, setOpenEnc] = useState<string[]>([]);
  const encounters = [...ehr.encounters].sort((a, b) => b.encounter_date.localeCompare(a.encounter_date));

  return (
    <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]" data-demo="context-panel">
      <Card className="gap-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">EHR snapshot</h2>
          <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
            <DatabaseIcon aria-hidden /> synthetic_hospital record {patient.patientId}
          </Badge>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              <StethoscopeIcon aria-hidden className="size-3.5" /> Problem list
            </dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {[...ehr.primary_diagnoses, ...ehr.profile.chronic_conditions.filter((c) => !ehr.primary_diagnoses.includes(c))].map((d) => (
                <Badge key={d} variant="secondary" className="font-normal whitespace-normal text-left h-auto">
                  {d}
                </Badge>
              ))}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              <PillIcon aria-hidden className="size-3.5" /> Home medications
            </dt>
            <dd className="mt-1 space-y-0.5">
              {ehr.profile.home_medications.length === 0 && <span className="text-muted-foreground">None recorded</span>}
              {ehr.profile.home_medications.map((m) => (
                <div key={m.name + m.dose}>
                  <span className="font-medium">{m.name}</span> <span className="text-muted-foreground">{m.dose}</span>
                </div>
              ))}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              <TriangleAlertIcon aria-hidden className="size-3.5" /> Allergies
            </dt>
            <dd className="mt-1">{ehr.profile.allergies.join(", ") || "None recorded"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Social</dt>
            <dd className="mt-1 text-muted-foreground">
              {ehr.profile.occupation}. Smoking: {ehr.profile.smoking_status}. Alcohol: {ehr.profile.alcohol_use}.
            </dd>
          </div>
        </dl>
        <div>
          <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground font-sans">
            {encounters.length} encounters · newest first
          </h3>
          <Accordion type="multiple" value={openEnc} onValueChange={setOpenEnc} className="mt-1">
            {encounters.map((e) => (
              <AccordionItem key={e.encounter_id} value={String(e.encounter_id)}>
                <AccordionTrigger className="py-2 text-sm hover:no-underline">
                  <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 text-left">
                    <span className="tabular-nums text-muted-foreground">{e.encounter_date}</span>
                    <span className="font-medium">{e.department}</span>
                    <span className="text-xs uppercase text-muted-foreground">{e.encounter_type}</span>
                    <span className="basis-full text-muted-foreground truncate">{e.chief_complaint}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ScrollArea className="h-56 rounded-md border bg-muted/40">
                    <pre className="whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed">{e.note_text}</pre>
                  </ScrollArea>
                  <p className="mt-1 text-xs text-muted-foreground">Encounter {e.encounter_id} · {e.attending_name}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Card>

      <Card className="gap-4 p-4 sm:p-5 self-start lg:sticky lg:top-20">
        <div>
          <h2 className="text-lg font-semibold">Before we write anything</h2>
          <p className="text-sm text-muted-foreground">
            Upcoming: <span className="text-foreground">{seed.upcomingVisit.department}</span>, {seed.upcomingVisit.reason.toLowerCase()}, in {seed.upcomingVisit.daysUntil} day{seed.upcomingVisit.daysUntil === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="checkin">&ldquo;What matters to you?&rdquo; check-in</Label>
          <Textarea id="checkin" value={context.checkin} onChange={(e) => onChange({ ...context, checkin: e.target.value })} rows={4} className="font-voice text-base" />
          <p className="text-xs text-muted-foreground">{seed.checkinSource}. Patient-stated; the engine treats it as their words, not as a chart fact.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="audience">Audience</Label>
            <Select value={context.audience} onValueChange={(v) => onChange({ ...context, audience: audienceSchema.parse(v) })}>
              <SelectTrigger id="audience" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {audienceSchema.options.map((a) => (
                  <SelectItem key={a} value={a}>
                    {AUDIENCE_LABEL[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="language">Language</Label>
            <Select value={context.language} onValueChange={(v) => onChange({ ...context, language: v === "es" ? "es" : "en" })}>
              <SelectTrigger id="language" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="channel">Channel</Label>
            <Select value={context.channel} onValueChange={(v) => onChange({ ...context, channel: v === "portal" ? "portal" : v === "phone" ? "phone" : "sms" })}>
              <SelectTrigger id="channel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sms">Text message</SelectItem>
                <SelectItem value="portal">Portal</SelectItem>
                <SelectItem value="phone">Phone script</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {seed.caregiver && (
          <p className="text-xs text-muted-foreground">
            Caregiver on file: <span className="text-foreground">{seed.caregiver}</span> (seeded).
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="lg" onClick={() => onBuild("live")} disabled={building} data-demo="build-button" className={cn(!modelAvailable && "hidden")}>
            {building ? <Loader2Icon aria-hidden className="animate-spin" /> : <SparklesIcon aria-hidden />} {hasRun ? "Build again" : "Build Persona"}
          </Button>
          {(cachedAvailable || !modelAvailable) && (
            <Button size={modelAvailable ? "lg" : "lg"} variant={modelAvailable ? "outline" : "default"} onClick={() => onBuild("cached")} disabled={building}>
              {building ? <Loader2Icon aria-hidden className="animate-spin" /> : <DatabaseIcon aria-hidden />} {cachedAvailable ? "Use cached output" : "Build with rules only"}
            </Button>
          )}
          {edited && (
            <Button variant="ghost" size="sm" onClick={onReset} disabled={building}>
              <RotateCcwIcon aria-hidden /> Reset to seeded check-in
            </Button>
          )}
        </div>
        {!modelAvailable && <p className="text-xs text-warn">No model key configured. Builds use cached output where it exists, otherwise the rules-based fallback. Both are labeled.</p>}
      </Card>
    </div>
  );
}
