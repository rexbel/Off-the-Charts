import { interpolate } from "remotion";
import type { Language } from "@/lib/schemas";
import { contentArea, headlineStyle, useSceneMotion, type SceneProps } from "./shared";

const SIGNOFF: Record<Language, (name: string) => string> = {
  en: (name) => `Take care, ${name}`,
  es: (name) => `Cuídese, ${name}`,
};

/** Warm sign-off with the contact line set in an accent pill so it is the last thing seen. */
export function ClosingScene({ scene, palette, preferredName, language, durationInFrames, index }: SceneProps) {
  const { frame, style } = useSceneMotion(durationInFrames, { rise: 24, fadeIn: index > 0 });
  const pillOpacity = interpolate(frame, [16, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pillRise = interpolate(frame, [16, 36], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ ...contentArea, alignItems: "flex-start" }}>
      <div style={{ ...style, display: "flex", flexDirection: "column", gap: 28, maxWidth: 1060 }}>
        <div style={{ height: 8, width: 120, borderRadius: 4, backgroundColor: palette.accent }} />
        <h2 style={headlineStyle(palette, 72)}>{scene.title ?? SIGNOFF[language](preferredName)}</h2>
        <p
          style={{
            margin: 0,
            opacity: pillOpacity,
            transform: `translateY(${pillRise}px)`,
            alignSelf: "flex-start",
            backgroundColor: palette.accent,
            color: palette.accentInk,
            borderRadius: 28,
            padding: "22px 36px",
            fontSize: 32,
            fontWeight: 600,
            lineHeight: 1.35,
          }}
        >
          {scene.text}
        </p>
      </div>
    </div>
  );
}
