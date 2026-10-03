"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import type { Language, Scene, VideoScript } from "@/lib/schemas";
import { prefetchSpeech, probeServerVoice, readAloud, stopSpeaking, useVoiceSource } from "@/lib/client/speech";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatFrames,
  patientPalette,
  sceneDurationsInFrames,
  sceneIndexAtFrame,
  sceneStartFrames,
  totalDurationInFrames,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  VisitVideo,
  type VideoPalette,
  type VisitVideoProps,
} from "@/remotion";

export type VideoPlayerProps = {
  script: VideoScript;
  preferredName: string;
  language: Language;
  /** Defaults to the warm patient palette. */
  palette?: VideoPalette;
  autoPlay?: boolean;
  /** Fires when playback or a seek enters a different scene. */
  onSceneChange?: (index: number, scene: Scene) => void;
  className?: string;
};


/**
 * Frames into a scene that the strip seeks to. Scenes fade in over the first
 * half second, so landing exactly on frame 0 while paused shows a blank card.
 */
const SCENE_SEEK_OFFSET = 20;

const KIND_LABEL: Record<Language, Record<Scene["kind"], string>> = {
  en: { title: "Welcome", card: "Card", steps: "Steps", choice: "Your choice", closing: "Sign-off" },
  es: { title: "Bienvenida", card: "Tarjeta", steps: "Pasos", choice: "Su elección", closing: "Despedida" },
};

const UI_TEXT = {
  en: {
    scenes: "Scenes",
    voice: "Voice",
    voiceHint: "Reads each card aloud.",
    captionsOnly: "Captions only on this device",
    sceneOf: (n: number, total: number) => `Scene ${n} of ${total}`,
    noScenes: "This video has no scenes yet.",
    loading: "Loading video…",
    failed: "The video could not be shown. Reload the page to try again.",
    on: "On",
    off: "Off",
  },
  es: {
    scenes: "Escenas",
    voice: "Voz",
    voiceHint: "Lee cada tarjeta en voz alta.",
    captionsOnly: "Solo subtítulos en este dispositivo",
    sceneOf: (n: number, total: number) => `Escena ${n} de ${total}`,
    noScenes: "Este video aún no tiene escenas.",
    loading: "Cargando video…",
    failed: "No se pudo mostrar el video. Vuelva a cargar la página.",
    on: "Activada",
    off: "Apagada",
  },
} satisfies Record<Language, unknown>;

const noopSubscribe = () => () => {};
/**
 * Voice for the scenes: the server voice (ElevenLabs, cached) when configured,
 * else the browser's own speech. `supported` is null during server render.
 */
function useSceneVoice(language: Language) {
  // null during server render; after hydration the toggle is offered and read-aloud picks the best available voice.
  const supported = useSyncExternalStore<boolean | null>(noopSubscribe, () => true, () => null);
  const source = useVoiceSource();

  useEffect(() => {
    probeServerVoice();
    return () => stopSpeaking();
  }, []);

  const stop = useCallback(() => {
    stopSpeaking();
  }, []);

  const speak = useCallback(
    (text: string) => {
      void readAloud(text, language);
    },
    [language],
  );

  return { supported, speak, stop, source };
}

function sceneLabel(scene: Scene): string {
  if (scene.title) return scene.title;
  const text = scene.text.trim();
  return text.length > 56 ? `${text.slice(0, 56).trimEnd()}…` : text;
}

/**
 * Inline player for a patient-facing visit video, with a scene strip and an
 * optional browser voice. Pass a `key` tied to the script when swapping
 * scripts so playback and scene state start fresh.
 */
export function VideoPlayer({
  script,
  preferredName,
  language,
  palette = patientPalette,
  autoPlay = false,
  onSceneChange,
  className,
}: VideoPlayerProps) {
  const t = UI_TEXT[language];
  const fps = VIDEO_FPS;
  const playerRef = useRef<PlayerRef>(null);
  const sceneRef = useRef(0);
  const onSceneChangeRef = useRef(onSceneChange);

  const starts = useMemo(() => sceneStartFrames(script, fps), [script, fps]);
  const durations = useMemo(() => sceneDurationsInFrames(script, fps), [script, fps]);
  const total = useMemo(() => totalDurationInFrames(script, fps), [script, fps]);

  const [currentScene, setCurrentScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const voice = useSceneVoice(language);

  useEffect(() => {
    onSceneChangeRef.current = onSceneChange;
  }, [onSceneChange]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const speakScene = (index: number) => {
      const scene = script.scenes[index];
      if (voiceOn && scene) voice.speak(scene.voiceover);
    };
    const enterScene = (index: number) => {
      if (index === sceneRef.current) return false;
      sceneRef.current = index;
      setCurrentScene(index);
      onSceneChangeRef.current?.(index, script.scenes[index]);
      return true;
    };

    const onFrame = ({ detail }: { detail: { frame: number } }) => {
      const index = sceneIndexAtFrame(starts, detail.frame);
      if (enterScene(index) && player.isPlaying()) speakScene(index);
    };
    const onSeeked = ({ detail }: { detail: { frame: number } }) => {
      voice.stop();
      const index = sceneIndexAtFrame(starts, detail.frame);
      enterScene(index);
      if (player.isPlaying()) speakScene(index);
    };
    const onPlay = () => {
      setIsPlaying(true);
      speakScene(sceneIndexAtFrame(starts, player.getCurrentFrame()));
    };
    const onPause = () => {
      setIsPlaying(false);
      voice.stop();
    };
    const onEnded = () => {
      setIsPlaying(false);
      voice.stop();
    };

    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("seeked", onSeeked);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onEnded);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("seeked", onSeeked);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onEnded);
    };
  }, [script, starts, voiceOn, voice]);

  const seekToScene = (index: number) => {
    const start = starts[index] ?? 0;
    const lastFrame = start + (durations[index] ?? 1) - 1;
    playerRef.current?.seekTo(Math.min(start + SCENE_SEEK_OFFSET, lastFrame));
  };

  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    if (!next) {
      voice.stop();
      return;
    }
    prefetchSpeech(script.scenes.map((s) => s.voiceover), language);
    const player = playerRef.current;
    if (player?.isPlaying()) {
      const scene = script.scenes[sceneIndexAtFrame(starts, player.getCurrentFrame())];
      if (scene) voice.speak(scene.voiceover);
    }
  };

  const inputProps: VisitVideoProps = { script, palette, preferredName, language };

  if (script.scenes.length === 0 || total === 0) {
    return (
      <div className={cn("rounded-xl border border-dashed p-6 text-sm text-muted-foreground", className)}>
        {t.noScenes}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div
        role="group"
        aria-label={`${script.title}. ${t.sceneOf(currentScene + 1, script.scenes.length)}.`}
        className="overflow-hidden rounded-xl bg-[#1F2421] shadow-sm ring-1 ring-black/10"
      >
        <Player
          ref={playerRef}
          component={VisitVideo}
          inputProps={inputProps}
          durationInFrames={total}
          fps={fps}
          compositionWidth={VIDEO_WIDTH}
          compositionHeight={VIDEO_HEIGHT}
          style={{ width: "100%" }}
          controls
          loop={false}
          autoPlay={autoPlay}
          clickToPlay
          spaceKeyToPlayOrPause
          // The composition is silent; the only sound is the browser voice below. Muting skips
          // Remotion's audio-context setup, which otherwise needs a user gesture before frames advance.
          initiallyMuted
          showVolumeControls={false}
          initiallyShowControls
          renderLoading={() => (
            <div className="flex h-full w-full items-center justify-center text-sm text-white/80">{t.loading}</div>
          )}
          errorFallback={() => (
            <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-white">
              {t.failed}
            </div>
          )}
        />
      </div>

      {/* Visible transcript of the current caption: readable on small screens where the burned-in strip is tiny. */}
      <p aria-live="polite" className="text-sm leading-snug text-muted-foreground">
        <span className="font-medium text-foreground">{t.sceneOf(currentScene + 1, script.scenes.length)}</span>
        {" · "}
        {script.scenes[currentScene].voiceover}
      </p>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{script.title}</p>
          <p className="text-xs text-muted-foreground">
            {script.scenes.length} {t.scenes.toLowerCase()} · {formatFrames(total, fps)}
          </p>
        </div>

        {voice.supported === true ? (
          <div className="flex flex-col items-end gap-1">
            <Button
              type="button"
              variant={voiceOn ? "default" : "outline"}
              size="sm"
              aria-pressed={voiceOn}
              onClick={toggleVoice}
              title={t.voiceHint}
            >
              <span aria-hidden className={cn("size-2 rounded-full", voiceOn ? "bg-current" : "bg-muted-foreground/50")} />
              {t.voice}: {voiceOn ? t.on : t.off}
            </Button>
            {voiceOn && isPlaying ? <span className="text-xs text-muted-foreground">{t.voiceHint}</span> : null}
          </div>
        ) : voice.supported === false ? (
          <p className="text-xs text-muted-foreground">{t.captionsOnly}</p>
        ) : null}
      </div>

      <ol aria-label={t.scenes} className="flex flex-wrap gap-2">
        {script.scenes.map((scene, i) => {
          const active = i === currentScene;
          return (
            <li key={`${i}-${scene.kind}`} className="min-w-0 flex-1 basis-[11rem]">
              <Button
                type="button"
                variant={active ? "default" : "outline"}
                aria-current={active ? "true" : undefined}
                aria-label={`${t.sceneOf(i + 1, script.scenes.length)}: ${sceneLabel(scene)}`}
                onClick={() => seekToScene(i)}
                className="h-auto w-full flex-col items-start gap-1 px-3 py-2.5 text-left whitespace-normal"
              >
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide",
                    active ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {i + 1} · {KIND_LABEL[language][scene.kind]} · {formatFrames(durations[i], fps)}
                </span>
                <span className="text-sm leading-snug">{sceneLabel(scene)}</span>
              </Button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
