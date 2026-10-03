import type { CSSProperties } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Language, Scene, VideoScript } from "@/lib/schemas";
import type { VideoPalette } from "../palette";

/** Rounded, friendly system stack. No network fonts load inside the composition. */
export const VIDEO_FONT_FAMILY =
  '"Nunito", "Avenir Next", "Avenir", "Segoe UI Variable", "Segoe UI", ui-rounded, system-ui, -apple-system, sans-serif';

/** Horizontal safe margin inside the 1280 frame. */
export const FRAME_MARGIN = 80;
/** Height reserved at the bottom for the caption strip (two lines plus margin). */
export const CAPTION_AREA_HEIGHT = 176;

export type SceneProps = {
  scene: Scene;
  script: VideoScript;
  palette: VideoPalette;
  preferredName: string;
  language: Language;
  /** Length of this scene's Sequence, so exits can be timed. */
  durationInFrames: number;
  /** 0-based position in the script. The first scene skips its fade-in. */
  index: number;
  /** Spot illustration for this scene (public path), chosen by src/remotion/spots.ts. */
  spot?: string;
  /** One spot per list item, for steps scenes. */
  itemSpots?: string[];
};

export const STAGE_LABEL: Record<Language, Record<VideoScript["stage"], string>> = {
  en: { before: "Before your visit", after: "After your visit" },
  es: { before: "Antes de su visita", after: "Después de su visita" },
};

export const GREETING: Record<Language, (name: string) => string> = {
  en: (name) => `Hi, ${name}`,
  es: (name) => `Hola, ${name}`,
};

export const CHOICE_LEAD: Record<Language, string> = {
  en: "You can…",
  es: "Usted puede…",
};

/**
 * Gentle enter/exit for a whole scene: a fade plus a short rise on entry, and
 * a fade on exit. Call once per scene component and spread `style` on the
 * scene's content wrapper.
 */
export function useSceneMotion(
  durationInFrames: number,
  options?: {
    rise?: number;
    /** Set false for the opening scene so a paused, unplayed player still shows a composed card. */
    fadeIn?: boolean;
  },
) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = options?.rise ?? 18;

  const enter = spring({ frame, fps, config: { damping: 200, stiffness: 90, mass: 0.9 } });
  const fadeIn =
    options?.fadeIn === false
      ? 1
      : interpolate(frame, [0, 14], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const fadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames - 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const style: CSSProperties = {
    opacity: Math.min(fadeIn, fadeOut),
    transform: `translateY(${(1 - enter) * rise}px)`,
  };
  return { frame, fps, style };
}

/** Spring-in for a single item that begins at `delay` frames. */
export function useStaggeredEnter(delay: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, stiffness: 110, mass: 0.8 },
  });
  const opacity = interpolate(frame - delay, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { progress, opacity };
}

/** Content region above the caption strip, centered horizontally. */
export const contentArea: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: CAPTION_AREA_HEIGHT,
  paddingLeft: FRAME_MARGIN,
  paddingRight: FRAME_MARGIN,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "stretch",
};

export function kickerStyle(palette: VideoPalette): CSSProperties {
  return {
    color: palette.accent,
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    margin: 0,
  };
}

export function headlineStyle(palette: VideoPalette, size = 68): CSSProperties {
  return {
    color: palette.ink,
    fontSize: size,
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: -1,
    margin: 0,
  };
}

export function bodyStyle(palette: VideoPalette, size = 36): CSSProperties {
  return {
    color: palette.ink,
    fontSize: size,
    fontWeight: 500,
    lineHeight: 1.35,
    margin: 0,
  };
}

export function cardStyle(palette: VideoPalette): CSSProperties {
  return {
    backgroundColor: palette.surface,
    border: `3px solid ${palette.surfaceBorder}`,
    borderRadius: 36,
    padding: "48px 56px",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  };
}
