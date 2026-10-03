"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpRightIcon, CheckIcon, InboxIcon, PencilIcon, ShieldAlertIcon, StethoscopeIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScorePill, SourceBadge } from "@/components/badges";
import { api, ApiRequestError } from "@/lib/client/api";
import { TOUCHPOINT_LABEL, type QueueItem, type TouchpointKind } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type Filter = "all" | "messages" | "brief" | "summary" | "video";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "messages", label: "Messages" },
  { key: "brief", label: "Brief" },
  { key: "summary", label: "Summary" },
  { key: "video", label: "Video" },
];

/** Which workspace tab a touchpoint kind lives on. Doubles as the filter group. */
function groupOf(kind: TouchpointKind): Exclude<Filter, "all"> {
  if (kind === "brief" || kind === "summary") return kind;
  if (kind === "video_before" || kind === "video_after") return "video";
  return "messages";
}

type Override = { text?: string; score?: number; blocked?: boolean };

/**
 * Cross-patient approval list. Server data arrives as props; decisions are
 * applied optimistically (the row leaves at once) and the server is refreshed
 * behind it. A failed request puts the row back and shows the server's reason.
 */
export function QueueList({ items, canApprove }: { items: QueueItem[]; canApprove: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<QueueItem | null>(null);
  const [draft, setDraft] = useState("");

  const live = useMemo(
    () =>
      items
        .filter((i) => !removed.has(i.touchpoint.id))
        .map((i) => {
          const o = overrides[i.touchpoint.id];
          return o ? { ...i, touchpoint: { ...i.touchpoint, text: o.text ?? i.touchpoint.text }, score: o.score ?? i.score, blocked: o.blocked ?? i.blocked } : i;
        }),
    [items, removed, overrides],
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: live.length, messages: 0, brief: 0, summary: 0, video: 0 };
    for (const i of live) c[groupOf(i.touchpoint.kind)] += 1;
    return c;
  }, [live]);
  const blockedCount = live.filter((i) => i.blocked).length;

  const shown = live.filter((i) => (filter === "all" || groupOf(i.touchpoint.kind) === filter) && (!blockedOnly || i.blocked));
  const byPatient = new Map<number, QueueItem[]>();
  for (const i of shown) byPatient.set(i.touchpoint.patientId, [...(byPatient.get(i.touchpoint.patientId) ?? []), i]);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const restore = (id: string) =>
    setRemoved((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const decide = async (item: QueueItem, action: "approve" | "reject") => {
    const id = item.touchpoint.id;
    setBusy(id);
    setRemoved((prev) => new Set(prev).add(id));
    try {
      await api.touchpoint(id, { action });
      const label = TOUCHPOINT_LABEL[item.touchpoint.kind];
      toast.success(action === "approve" ? `Approved for ${item.patientName}. It's in the outbox; sending is simulated.` : `Rejected ${label.toLowerCase()} for ${item.patientName}.`, {
        description: action === "approve" ? label : "It stays on the patient's workspace, marked rejected.",
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await api.touchpoint(id, { action: "reset" });
              restore(id);
              router.refresh();
              toast.success("Back in the queue.");
            } catch (err) {
              toast.error(err instanceof ApiRequestError ? err.message : "Could not undo.");
            }
          },
        },
      });
      router.refresh();
    } catch (err) {
      restore(id);
      if (err instanceof ApiRequestError && (err.status === 403 || err.status === 409)) toast.error(err.message);
      else toast.error(err instanceof Error ? err.message : "That didn't save. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const openEdit = (item: QueueItem) => {
    setDraft(item.touchpoint.text);
    setEditing(item);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const id = editing.touchpoint.id;
    setBusy(id);
    try {
      const res = await api.touchpoint(id, { action: "edit", text: draft });
      setOverrides((prev) => ({ ...prev, [id]: { text: res.touchpoint.text, score: res.score.score, blocked: res.score.blocked } }));
      setEditing(null);
      toast.success(res.score.blocked ? `Saved and re-scored: ${res.score.score}/100. Still blocked by a privacy rule.` : `Saved and re-scored: ${res.score.score}/100.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Could not save the edit.");
    } finally {
      setBusy(null);
    }
  };

  if (live.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed p-10 text-center" data-demo="queue-empty">
        <InboxIcon aria-hidden className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-2 font-medium">Nothing waiting.</p>
        <p className="text-sm text-muted-foreground">Build a persona and its touchpoints land here.</p>
        <Button asChild className="mt-4">
          <Link href="/">
            Go to patients <ArrowUpRightIcon aria-hidden />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <section className="mt-8" aria-labelledby="queue-heading" data-demo="queue-list">
      <h2 id="queue-heading" className="sr-only">
        Pending touchpoints
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList aria-label="Filter by touchpoint type">
              {FILTERS.map((f) => (
                <TabsTrigger key={f.key} value={f.key} disabled={f.key !== "all" && counts[f.key] === 0} aria-label={`${f.label}, ${counts[f.key]}`}>
                  {f.label}
                  <span aria-hidden className="hidden tabular-nums text-muted-foreground sm:inline">
                    {counts[f.key]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="blocked-only" checked={blockedOnly} onCheckedChange={setBlockedOnly} disabled={blockedCount === 0 && !blockedOnly} />
          <Label htmlFor="blocked-only" className={cn("text-sm", blockedCount === 0 && !blockedOnly && "text-muted-foreground")}>
            <ShieldAlertIcon aria-hidden className="size-3.5 text-inferred" />
            Blocked only <span className="tabular-nums text-muted-foreground">({blockedCount})</span>
          </Label>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p>Nothing matches this filter.</p>
          <Button
            variant="link"
            className="mt-1"
            onClick={() => {
              setFilter("all");
              setBlockedOnly(false);
            }}
          >
            Show everything waiting
          </Button>
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {[...byPatient.entries()].map(([pid, rows]) => {
            const first = rows[0];
            const blockedHere = rows.filter((r) => r.blocked).length;
            return (
              <Card key={pid} className="gap-3 p-4" data-demo={`queue-patient-${pid}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <h3 className="font-heading text-xl leading-tight">
                    <Link href={`/patients/${pid}`} className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                      {first.patientName}
                    </Link>
                  </h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {rows.length} waiting{blockedHere ? `, ${blockedHere} blocked` : ""}
                  </span>
                  <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <SourceBadge source={first.runSource} />
                    <span>
                      built{" "}
                      <time dateTime={first.runCreatedAt} suppressHydrationWarning>
                        {new Date(first.runCreatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </time>
                    </span>
                  </div>
                </div>
                <ul className="grid gap-2" role="list">
                  {rows.map((item) => (
                    <QueueRow
                      key={item.touchpoint.id}
                      item={item}
                      canApprove={canApprove}
                      busy={busy === item.touchpoint.id}
                      anyBusy={busy !== null}
                      expanded={expanded.has(item.touchpoint.id)}
                      onToggle={() => toggleExpanded(item.touchpoint.id)}
                      onApprove={() => decide(item, "approve")}
                      onReject={() => decide(item, "reject")}
                      onEdit={() => openEdit(item)}
                    />
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit before {canApprove ? "approving" : "it reaches a clinician"}</DialogTitle>
            <DialogDescription>
              {editing ? `${TOUCHPOINT_LABEL[editing.touchpoint.kind]} for ${editing.patientName}, to ${editing.touchpoint.recipient}. ` : ""}
              Your edit is re-scored by the same rules. Approval stays blocked while a restricted term is present.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="queue-edit-text">Text</Label>
            <Textarea id="queue-edit-text" value={draft} onChange={(e) => setDraft(e.target.value)} rows={9} className="font-voice text-base leading-relaxed" />
            {editing?.blocked && (
              <p className="flex items-start gap-1.5 text-xs text-inferred">
                <ShieldAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" /> A privacy rule is violated in the current text. Remove the restricted detail, then save to re-score.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={!draft.trim() || busy !== null}>
              Save and re-score
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function QueueRow({
  item,
  canApprove,
  busy,
  anyBusy,
  expanded,
  onToggle,
  onApprove,
  onReject,
  onEdit,
}: {
  item: QueueItem;
  canApprove: boolean;
  busy: boolean;
  anyBusy: boolean;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
}) {
  const tp = item.touchpoint;
  const textId = `queue-text-${tp.id}`;
  const label = TOUCHPOINT_LABEL[tp.kind];
  const long = tp.text.length > 220 || tp.text.split("\n").length > 3;
  return (
    <li className={cn("grid gap-3 rounded-lg border bg-background p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start", busy && "opacity-60")} aria-busy={busy} data-demo={`queue-row-${tp.kind}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{label}</span>
          <span>to {tp.recipient}</span>
          <ScorePill score={item.score} blocked={item.blocked} size="sm" />
          {item.blocked && (
            <span className="inline-flex items-center gap-1 text-inferred">
              <ShieldAlertIcon aria-hidden className="size-3.5" /> Privacy rule, edit before approving
            </span>
          )}
        </div>
        <p id={textId} className={cn("mt-1.5 whitespace-pre-wrap font-voice text-sm leading-relaxed", !expanded && "line-clamp-3")}>
          {tp.text}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {long && (
            <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={textId} className="rounded-sm font-medium text-teal underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
              {expanded ? "Show less" : "Show full"}
            </button>
          )}
          <Link href={`/patients/${tp.patientId}?tab=${groupOf(tp.kind)}`} className="inline-flex items-center gap-0.5 rounded-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
            Open in workspace <ArrowUpRightIcon aria-hidden className="size-3.5" />
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 lg:justify-end" role="group" aria-label={`Decide on ${label} for ${item.patientName}`}>
        {canApprove ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={item.blocked ? 0 : -1} className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <Button size="sm" onClick={onApprove} disabled={item.blocked || anyBusy} aria-disabled={item.blocked} aria-label={`Approve ${label} for ${item.patientName}`}>
                  {item.blocked ? <ShieldAlertIcon aria-hidden /> : <CheckIcon aria-hidden />} Approve
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{item.blocked ? "A privacy rule is violated. Edit the text first." : "Approve for the simulated outbox."}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <StethoscopeIcon aria-hidden className="size-3.5" /> Needs a clinician
          </span>
        )}
        <Button size="sm" variant="outline" onClick={onEdit} disabled={anyBusy} aria-label={`Edit ${label} for ${item.patientName}`}>
          <PencilIcon aria-hidden /> Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={onReject} disabled={anyBusy} aria-label={`Reject ${label} for ${item.patientName}`}>
          <XIcon aria-hidden /> Reject
        </Button>
      </div>
    </li>
  );
}
