import { Bubble, ClinicAvatar, EmojiPop, Pill, TypingDots } from "./comic";
import { GREETING, STAGE_LABEL, type SceneProps } from "./shared";

/** Opening scene: the clinic starts the conversation. Typing dots, then a greeting bubble, then the scene text. */
export function TitleScene({ scene, script, preferredName, language, index }: SceneProps) {
  const first = index === 0;
  return (
    <>
      <div style={{ position: "absolute", top: 36, left: 56 }}>
        <Pill>{STAGE_LABEL[language][script.stage]}</Pill>
      </div>
      {/* The opening frame is the poster: show the greeting at once. Later title scenes get the typing dots first. */}
      {!first && <TypingDots x={56} y={104} delay={2} exitAt={24} />}
      <Bubble x={56} y={104} width={540} delay={first ? 0 : 26} instant={first} avatar={<ClinicAvatar />} fontSize={44}>
        {GREETING[language](preferredName)}!
      </Bubble>
      <Bubble tone="patient" x={80} y={280} width={540} delay={first ? 18 : 50} fontSize={28}>
        {scene.text}
      </Bubble>
      <EmojiPop emoji="👋" x={620} y={40} delay={first ? 10 : 40} size={88} />
    </>
  );
}
