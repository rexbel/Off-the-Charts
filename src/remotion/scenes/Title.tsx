import { interpolate } from "remotion";
import {
  bodyStyle,
  contentArea,
  GREETING,
  headlineStyle,
  kickerStyle,
  STAGE_LABEL,
  useSceneMotion,
  type SceneProps,
} from "./shared";

/** Opening card: stage label, a big greeting with the person's name, then the scene text. */
export function TitleScene({ scene, script, palette, preferredName, language, durationInFrames, index }: SceneProps) {
  const { frame, style } = useSceneMotion(durationInFrames, { rise: 24, fadeIn: index > 0 });
  const ruleWidth = interpolate(frame, [6, 30], [0, 120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const detailOpacity = interpolate(frame, [14, 30], [index > 0 ? 0 : 0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ ...contentArea, alignItems: "flex-start" }}>
      <div style={{ ...style, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1040 }}>
        <p style={kickerStyle(palette)}>{STAGE_LABEL[language][script.stage]}</p>
        <h1 style={headlineStyle(palette, 88)}>{GREETING[language](preferredName)}</h1>
        <div style={{ height: 8, width: ruleWidth, borderRadius: 4, backgroundColor: palette.accent }} />
        <div style={{ opacity: detailOpacity, display: "flex", flexDirection: "column", gap: 12 }}>
          {scene.title ? <p style={{ ...headlineStyle(palette, 44), letterSpacing: 0 }}>{scene.title}</p> : null}
          <p style={{ ...bodyStyle(palette, 34), color: palette.inkMuted }}>{scene.text}</p>
        </div>
      </div>
    </div>
  );
}
