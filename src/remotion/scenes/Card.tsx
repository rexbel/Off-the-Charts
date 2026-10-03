import { bodyStyle, cardStyle, contentArea, headlineStyle, useSceneMotion, type SceneProps } from "./shared";

/** A single sand card: optional title plus a short body. */
export function CardScene({ scene, palette, durationInFrames, index }: SceneProps) {
  const { style } = useSceneMotion(durationInFrames, { fadeIn: index > 0 });

  return (
    <div style={contentArea}>
      <div style={{ ...style, ...cardStyle(palette) }}>
        <div style={{ height: 6, width: 56, borderRadius: 3, backgroundColor: palette.accent }} />
        {scene.title ? <h2 style={headlineStyle(palette, 48)}>{scene.title}</h2> : null}
        <p style={bodyStyle(palette, 38)}>{scene.text}</p>
      </div>
    </div>
  );
}
