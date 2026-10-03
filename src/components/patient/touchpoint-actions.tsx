"use client";

import { useState } from "react";
import { CheckIcon, PencilIcon, RotateCcwIcon, ShieldAlertIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TiScore, Touchpoint, TouchpointAction } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export type OnTouchpointAction = (tpId: string, action: TouchpointAction) => Promise<void>;

const STATUS: Record<Touchpoint["status"], { label: string; className: string }> = {
  pending: { label: "Needs review", className: "bg-muted text-muted-foreground" },
  approved: { label: "Approved", className: "bg-ok-soft text-ok" },
  edited: { label: "Approved · edited", className: "bg-ok-soft text-ok" },
  rejected: { label: "Rejected", className: "bg-bad-soft text-bad" },
};

export function TouchpointStatusBadge({ status }: { status: Touchpoint["status"] }) {
  const s = STATUS[status];
  return <Badge className={cn("border-transparent font-normal", s.className)}>{s.label}</Badge>;
}

/**
 * Approve / Edit / Reject / Reset for one touchpoint. Approval is disabled
 * while a privacy rule is violated, and the reason is spelled out.
 */
export function TouchpointActions({ tp, score, onAction, editLabel = "Edit", demoKey, canApprove = true }: { tp: Touchpoint; score: TiScore | null; onAction: OnTouchpointAction; editLabel?: string; demoKey?: string; canApprove?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tp.text);
  const blocked = Boolean(score?.blocked);
  const decided = tp.status === "approved" || tp.status === "edited" || tp.status === "rejected";

  const run = async (action: TouchpointAction) => {
    setBusy(action.action);
    try {
      await onAction(tp.id, action);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-demo={demoKey}>
      <TouchpointStatusBadge status={tp.status} />
      {(!decided || tp.status === "rejected") && !canApprove ? (
        <span className="text-xs text-muted-foreground">Needs a clinician to approve</span>
      ) : null}
      {(!decided || tp.status === "rejected") && canApprove ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" onClick={() => run({ action: "approve" })} disabled={blocked || busy !== null} aria-disabled={blocked}>
                {blocked ? <ShieldAlertIcon aria-hidden /> : <CheckIcon aria-hidden />} Approve
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{blocked ? "A privacy rule is violated. Edit the text first." : "Approve this touchpoint for the simulated outbox."}</TooltipContent>
        </Tooltip>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setDraft(tp.text);
          setEditing(true);
        }}
        disabled={busy !== null}
      >
        <PencilIcon aria-hidden /> {editLabel}
      </Button>
      {tp.status !== "rejected" && (
        <Button size="sm" variant="ghost" onClick={() => run({ action: "reject" })} disabled={busy !== null}>
          <XIcon aria-hidden /> Reject
        </Button>
      )}
      {(decided || tp.text !== tp.originalText) && (
        <Button size="sm" variant="ghost" onClick={() => run({ action: "reset" })} disabled={busy !== null} aria-label="Reset to the generated text and clear the decision">
          <RotateCcwIcon aria-hidden /> Reset
        </Button>
      )}

      {tp.sentAt && <span className="text-xs text-muted-foreground">Sent (simulated) {new Date(tp.sentAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit before approving</DialogTitle>
            <DialogDescription>Your edit is re-scored by the same rules. Approval stays blocked while a restricted term is present.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`edit-${tp.id}`}>Text</Label>
            <Textarea id={`edit-${tp.id}`} value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} className="font-voice text-base leading-relaxed" />
            {blocked && score && (
              <p className="text-xs text-inferred">
                Restricted here: {score.findings.filter((f) => f.rule === "privacy").flatMap((f) => f.matches.map((m) => `"${m.term}"`)).join(", ")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await run({ action: "edit", text: draft });
                setEditing(false);
              }}
              disabled={!draft.trim() || busy !== null}
            >
              Save edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
