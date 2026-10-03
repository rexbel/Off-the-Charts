import { interpolate, useCurrentFrame } from "remotion";
import type { VideoPalette } from "../palette";
import { countWords } from "../durations";
import { FRAME_MARGIN, VIDEO_FONT_FAMILY } from "./shared";
import { INK } from "./comic";

/** Characters that fit on two caption lines at the caption font size, with margin. */
export const CAPTION_MAX_CHARS = 100;
export const CAPTION_FONT_SIZE = 34;
const CAPTION_LINE_HEIGHT = 1.3;
const EXIT_FADE_FRAMES = 12;
const CHUNK_FADE_FRAMES = 6;

/**
 * Split spoken text into caption chunks that fit two lines. Sentences stay
 * whole when they can; a sentence that is too long on its own is split on
 * word boundaries into near-equal halves.
 */
export function captionChunks(text: string, maxChars = CAPTION_MAX_CHARS): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const sentences = clean.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = sentence;
  }
  if (current) chunks.push(current);

  return chunks.flatMap((chunk) => (chunk.length <= maxChars ? [chunk] : splitByClauses(chunk, maxChars)));
}

/** Break a long sentence at commas, semicolons or colons; fall back to words. */
function splitByClauses(text: string, maxChars: number): string[] {
  const clauses = text.split(/(?<=[,;:])\s+/).filter(Boolean);
  if (clauses.length < 2) return splitByWords(text, maxChars);
  const out: string[] = [];
  let current = "";
  for (const clause of clauses) {
    const candidate = current ? `${current} ${clause}` : clause;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) out.push(current);
    current = clause;
  }
  if (current) out.push(current);
  return out.flatMap((piece) => (piece.length <= maxChars ? [piece] : splitByWords(piece, maxChars)));
}

function splitByWords(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const pieces = Math.ceil(text.length / maxChars);
  const perPiece = Math.ceil(words.length / pieces);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += perPiece) {
    out.push(words.slice(i, i + perPiece).join(" "));
  }
  return out;
}

/**
 * Frame ranges for each chunk. Time is shared in proportion to word count so
 * the caption keeps pace with the spoken line.
 */
export function captionTimeline(chunks: string[], durationInFrames: number): { from: number; to: number }[] {
  const usable = Math.max(1, durationInFrames - EXIT_FADE_FRAMES);
  const weights = chunks.map((c) => Math.max(1, countWords(c)));
  const total = weights.reduce((a, b) => a + b, 0);
  let cursor = 0;
  return weights.map((w, i) => {
    const from = cursor;
    const to = i === weights.length - 1 ? usable : cursor + Math.round((w / total) * usable);
    cursor = to;
    return { from, to };
  });
}

export type CaptionProps = {
  text: string;
  palette: VideoPalette;
  durationInFrames: number;
  /** False for the opening scene so the caption is visible on the paused first frame. */
  fadeIn?: boolean;
};

/** Burned-in caption strip pinned to the bottom of every scene. */
export function Caption({ text, durationInFrames, fadeIn = true }: CaptionProps) {
  const frame = useCurrentFrame();
  const chunks = captionChunks(text);
  const timeline = captionTimeline(chunks, durationInFrames);
  const activeIndex = Math.max(
    0,
    timeline.findIndex(({ from, to }) => frame >= from && frame < to),
  );
  const active = chunks[activeIndex] ?? chunks[chunks.length - 1] ?? "";
  const activeFrom = timeline[activeIndex]?.from ?? 0;

  const chunkFade =
    activeIndex === 0 && !fadeIn
      ? 1
      : interpolate(frame - activeFrom, [0, CHUNK_FADE_FRAMES], [0.2, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const sceneFade = interpolate(
    frame,
    [0, 8, durationInFrames - EXIT_FADE_FRAMES, durationInFrames - 1],
    [fadeIn ? 0 : 1, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  if (!active) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: FRAME_MARGIN,
        right: FRAME_MARGIN,
        bottom: 44,
        display: "flex",
        justifyContent: "center",
        opacity: sceneFade,
      }}
    >
      <div
        style={{
          backgroundColor: "#FFFFFF",
          color: INK,
          border: `4px solid ${INK}`,
          boxShadow: "7px 7px 0 rgba(27,42,47,0.3)",
          borderRadius: 18,
          padding: "16px 32px",
          minHeight: CAPTION_FONT_SIZE * CAPTION_LINE_HEIGHT * 2 + 36,
          maxWidth: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: VIDEO_FONT_FAMILY,
            fontSize: CAPTION_FONT_SIZE,
            fontWeight: 600,
            lineHeight: CAPTION_LINE_HEIGHT,
            textAlign: "center",
            textWrap: "balance",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            opacity: chunkFade,
          }}
        >
          {active}
        </p>
      </div>
    </div>
  );
}
