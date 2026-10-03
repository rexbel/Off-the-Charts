import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { VIDEO_FONT_FAMILY } from "./shared";

/**
 * Comic-strip primitives for the illustrated chat scenes: an illustrated
 * backdrop with a halftone overlay, speech bubbles with thick outlines and a
 * hard offset shadow, a typing indicator, and emoji that pop in.
 */
export const INK = "#1B2A2F";
export const BUBBLE = {
  clinic: { bg: "#CFEEDC", tail: "#CFEEDC" }, // mint, like a message from the clinic
  patient: { bg: "#C6CBF7", tail: "#C6CBF7" }, // periwinkle
  neutral: { bg: "#FFFFFF", tail: "#FFFFFF" },
} as const;
export type BubbleTone = keyof typeof BUBBLE;

const HALFTONE: CSSProperties = {
  backgroundImage: `radial-gradient(${INK} 1.1px, transparent 1.7px)`,
  backgroundSize: "11px 11px",
  mixBlendMode: "multiply",
};

/** Full-frame illustration (public/video/scenes/*.webp) with a halftone wash and a darker base for captions. */
export function Backdrop({ src }: { src: string }) {
  return (
    <AbsoluteFill>
      <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 40%" }} />
      <AbsoluteFill style={{ ...HALFTONE, opacity: 0.08 }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(27,42,47,0.06) 0%, rgba(27,42,47,0) 35%, rgba(27,42,47,0) 60%, rgba(27,42,47,0.45) 100%)" }} />
    </AbsoluteFill>
  );
}

/** Spring that starts at `delay` frames; 0 before, settles at 1. */
export function usePop(delay: number, stiffness = 170) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness, mass: 0.7 } });
  const visible = frame >= delay ? 1 : 0;
  return { scale: visible ? s : 0, opacity: visible ? Math.min(1, s * 1.4) : 0, frame };
}

export function Bubble({
  children,
  tone = "clinic",
  side = "left",
  delay = 0,
  x,
  y,
  width = 560,
  avatar,
  fontSize = 34,
  exitAt,
  instant = false,
}: {
  children: ReactNode;
  tone?: BubbleTone;
  /** Which side the tail points to (towards the speaker). */
  side?: "left" | "right";
  delay?: number;
  x: number;
  y: number;
  width?: number;
  /** Small round avatar shown before the text, e.g. the clinic mark. */
  avatar?: ReactNode;
  fontSize?: number;
  /** Fade out from this frame (scene-relative). */
  exitAt?: number;
  /** Fully visible from frame 0 (the opening poster frame). */
  instant?: boolean;
}) {
  const pop = usePop(delay);
  const scale = instant ? 1 : pop.scale;
  const opacity = instant ? 1 : pop.opacity;
  const frame = pop.frame;
  const out = exitAt === undefined ? 1 : interpolate(frame, [exitAt, exitAt + 10], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const c = BUBBLE[tone];
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        transform: `scale(${0.75 + 0.25 * scale})`,
        transformOrigin: side === "left" ? "bottom left" : "bottom right",
        opacity: opacity * out,
      }}
    >
      <div
        style={{
          position: "relative",
          background: c.bg,
          border: `4px solid ${INK}`,
          borderRadius: 22,
          boxShadow: `8px 8px 0 rgba(27,42,47,0.28)`,
          padding: "20px 26px",
          display: "flex",
          gap: 18,
          alignItems: "flex-start",
          fontFamily: VIDEO_FONT_FAMILY,
          color: INK,
          fontSize,
          fontWeight: 700,
          lineHeight: 1.25,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0, ...HALFTONE, opacity: 0.12, pointerEvents: "none" }} />
        {avatar ? <div style={{ flexShrink: 0, position: "relative" }}>{avatar}</div> : null}
        <div style={{ position: "relative", minWidth: 0 }}>{children}</div>
      </div>
      {/* tail */}
      <div
        style={{
          position: "absolute",
          bottom: -22,
          [side === "left" ? "left" : "right"]: 46,
          width: 0,
          height: 0,
          borderLeft: side === "left" ? "6px solid transparent" : "30px solid transparent",
          borderRight: side === "left" ? "30px solid transparent" : "6px solid transparent",
          borderTop: `28px solid ${INK}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -14,
          [side === "left" ? "left" : "right"]: 52,
          width: 0,
          height: 0,
          borderLeft: side === "left" ? "4px solid transparent" : "22px solid transparent",
          borderRight: side === "left" ? "22px solid transparent" : "4px solid transparent",
          borderTop: `22px solid ${c.tail}`,
        }}
      />
    </div>
  );
}

/** The clinic's avatar: a round mint badge with a simple person glyph. */
export function ClinicAvatar({ size = 64 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#FFFFFF",
        border: `4px solid ${INK}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    </div>
  );
}

/** "…" typing indicator in a white bubble; the dots bob. */
export function TypingDots({ x, y, delay = 0, exitAt, side = "left" }: { x: number; y: number; delay?: number; exitAt?: number; side?: "left" | "right" }) {
  const frame = useCurrentFrame();
  return (
    <Bubble tone="neutral" side={side} x={x} y={y} width={150} delay={delay} exitAt={exitAt} fontSize={30}>
      <div style={{ display: "flex", gap: 12, padding: "6px 2px" }}>
        {[0, 1, 2].map((i) => {
          const bob = Math.sin((frame - delay) / 4 + i * 1.1) * 5;
          return <span key={i} style={{ width: 16, height: 16, borderRadius: 8, background: INK, display: "inline-block", transform: `translateY(${bob}px)` }} />;
        })}
      </div>
    </Bubble>
  );
}

/** An emoji that pops in and floats gently. */
export function EmojiPop({ emoji, x, y, delay = 0, size = 96 }: { emoji: string; x: number; y: number; delay?: number; size?: number }) {
  const { scale, opacity, frame } = usePop(delay, 220);
  const float = Math.sin((frame - delay) / 9) * 6;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: x,
        top: y,
        fontSize: size,
        lineHeight: 1,
        transform: `translateY(${float}px) scale(${scale}) rotate(${(1 - scale) * -20}deg)`,
        opacity,
        filter: "drop-shadow(5px 6px 0 rgba(27,42,47,0.28))",
      }}
    >
      {emoji}
    </div>
  );
}

/** Small rounded label with a thick outline, used for the stage kicker and step numbers. */
export function Pill({ children, color = "#FFD84D", style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        background: color,
        border: `4px solid ${INK}`,
        borderRadius: 999,
        padding: "8px 18px",
        fontFamily: VIDEO_FONT_FAMILY,
        fontWeight: 800,
        fontSize: 24,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        color: INK,
        boxShadow: `5px 5px 0 rgba(27,42,47,0.28)`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Width of the text panel on the left of split scenes. */
export const SPLIT_X = 470;

/**
 * Split comic layout for one idea: a cream text panel on the left and the spot
 * illustration on the right behind a jagged divider, so overlays never cover a
 * face. The picture pushes in slowly so the frame never sits still.
 */
export function SpotPanel({ src, durationInFrames, fadeIn = true }: { src: string; durationInFrames: number; fadeIn?: boolean }) {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, durationInFrames], [1.02, 1.09], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const slide = fadeIn ? interpolate(frame, [0, 14], [60, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const opacity = fadeIn ? interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  // Jagged divider: a zigzag from top to bottom around SPLIT_X.
  const teeth = 9;
  const pts: string[] = [];
  for (let i = 0; i <= teeth; i += 1) {
    const y = (720 / teeth) * i;
    const x = SPLIT_X + (i % 2 === 0 ? -18 : 18) + (i === 0 ? 30 : 0);
    pts.push(`${x},${y}`);
  }
  const clip = `polygon(${pts.map((p) => p.split(",").map((v, j) => (j === 0 ? `${v}px` : `${v}px`)).join(" ")).join(", ")}, 1280px 720px, 1280px 0px)`;
  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ background: "#FFF4DC" }}>
        <AbsoluteFill style={{ backgroundImage: `radial-gradient(rgba(27,42,47,0.10) 1.2px, transparent 1.8px)`, backgroundSize: "14px 14px" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ clipPath: clip, transform: `translateX(${slide}px)` }}>
        <Img src={src} style={{ position: "absolute", left: SPLIT_X - 40, top: 0, width: 1280 - SPLIT_X + 40, height: 720, objectFit: "cover", transform: `scale(${zoom})`, transformOrigin: "55% 45%" }} />
        <AbsoluteFill style={{ ...HALFTONE, opacity: 0.07 }} />
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(27,42,47,0) 62%, rgba(27,42,47,0.38) 100%)" }} />
      </AbsoluteFill>
      <svg width={1280} height={720} style={{ position: "absolute", inset: 0, transform: `translateX(${slide}px)` }} aria-hidden>
        <polyline points={pts.join(" ")} fill="none" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
      </svg>
    </AbsoluteFill>
  );
}

/** Solid motion-graphics ground with halftone dots, for diagram scenes. */
export function DiagramGround({ color = "#2A8C8F" }: { color?: string }) {
  return (
    <AbsoluteFill style={{ background: color }}>
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.22) 1.4px, transparent 2px)", backgroundSize: "18px 18px" }} />
    </AbsoluteFill>
  );
}
