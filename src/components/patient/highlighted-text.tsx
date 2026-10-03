import { Fragment } from "react";
import type { TiFinding } from "@/lib/schemas";

/**
 * Renders text with checker matches highlighted. Stigma/avoid terms get a
 * red underline; privacy hits a purple one. Each mark carries the suggestion
 * as a title so hovering explains the flag.
 */
export function HighlightedText({ text, findings }: { text: string; findings: TiFinding[] }) {
  type Mark = { index: number; length: number; className: string; title: string };
  const marks: Mark[] = [];
  for (const f of findings) {
    if (f.rule !== "stigma" && f.rule !== "privacy") continue;
    for (const m of f.matches) {
      marks.push({
        index: m.index,
        length: m.length,
        className: f.rule === "privacy" ? "ti-mark-privacy" : "ti-mark",
        title: f.rule === "privacy" ? `Restricted on this channel: "${m.term}"` : m.suggestion ? `"${m.term}" → ${m.suggestion}` : `Flagged: "${m.term}"`,
      });
    }
  }
  marks.sort((a, b) => a.index - b.index);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  marks.forEach((m, i) => {
    if (m.index < cursor) return; // overlapping match, skip
    if (m.index > cursor) parts.push(<Fragment key={`t${i}`}>{renderLines(text.slice(cursor, m.index))}</Fragment>);
    parts.push(
      <mark key={`m${i}`} className={m.className} title={m.title}>
        {text.slice(m.index, m.index + m.length)}
      </mark>,
    );
    cursor = m.index + m.length;
  });
  if (cursor < text.length) parts.push(<Fragment key="tail">{renderLines(text.slice(cursor))}</Fragment>);
  return <>{parts}</>;
}

function renderLines(s: string): React.ReactNode {
  const lines = s.split("\n");
  return lines.map((line, i) => (
    <Fragment key={i}>
      {line}
      {i < lines.length - 1 && <br />}
    </Fragment>
  ));
}
