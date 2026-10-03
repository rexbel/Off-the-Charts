import { Bubble, ClinicAvatar, Pill, SpotPanel } from "./comic";
import type { SceneProps } from "./shared";

/** Sign-off over the phone-call panel: a warm last message with the number as a pill. */
export function ClosingScene({ scene, spot, durationInFrames, index }: SceneProps) {
  const phone = `${scene.text} ${scene.voiceover}`.match(/\d{3}[-.\s]\d{4}/)?.[0];
  return (
    <>
      {spot ? <SpotPanel src={spot} durationInFrames={durationInFrames} fadeIn={index > 0} /> : null}
      {scene.title ? (
        <div style={{ position: "absolute", top: 36, left: 40 }}>
          <Pill>{scene.title}</Pill>
        </div>
      ) : null}
      <Bubble x={40} y={112} width={390} delay={8} avatar={<ClinicAvatar size={52} />} fontSize={30}>
        {scene.text}
      </Bubble>
      {phone ? (
        <div style={{ position: "absolute", left: 52, top: 300 }}>
          <Pill color="#FFFFFF" style={{ fontSize: 30, letterSpacing: 1 }}>
            📞 {phone}
          </Pill>
        </div>
      ) : null}
    </>
  );
}
