import { Bubble, ClinicAvatar, Pill, SpotPanel } from "./comic";
import type { SceneProps } from "./shared";

/** One idea, one picture: a full-frame illustration with a short heading and a compact message. */
export function CardScene({ scene, spot, durationInFrames, index }: SceneProps) {
  return (
    <>
      {spot ? <SpotPanel src={spot} durationInFrames={durationInFrames} fadeIn={index > 0} /> : null}
      {scene.title ? (
        <div style={{ position: "absolute", top: 36, left: 40 }}>
          <Pill color="#CFEEDC">{scene.title}</Pill>
        </div>
      ) : null}
      <Bubble x={40} y={112} width={390} delay={10} avatar={<ClinicAvatar size={52} />} fontSize={30}>
        {scene.text}
      </Bubble>
    </>
  );
}
