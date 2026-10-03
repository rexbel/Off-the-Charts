import type { Scene, VideoScript } from "@/lib/schemas";

/**
 * Scene timing, kept pure so the player can size the composition and map a
 * frame back to a scene without rendering anything.
 */

/** Pace of the browser voice and of a comfortable read-aloud: about 160 words a minute. */
export const WORDS_PER_MINUTE = 160;
/** Lead-in and settle time added to every scene, in seconds. */
export const SCENE_PADDING_SECONDS = 1;
export const MIN_SCENE_SECONDS = 3.5;
export const MAX_SCENE_SECONDS = 12;
/** Each revealed step needs a beat of its own, in seconds. */
export const SECONDS_PER_STEP = 1.1;

export const VIDEO_FPS = 30;
export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Seconds a scene should stay on screen, before frame rounding. */
export function sceneDurationInSeconds(scene: Scene): number {
  const spoken = (countWords(scene.voiceover) / WORDS_PER_MINUTE) * 60 + SCENE_PADDING_SECONDS;
  const stepped =
    scene.kind === "steps" && scene.items?.length
      ? scene.items.length * SECONDS_PER_STEP + SCENE_PADDING_SECONDS
      : 0;
  const wanted = Math.max(spoken, stepped);
  return Math.min(MAX_SCENE_SECONDS, Math.max(MIN_SCENE_SECONDS, wanted));
}

/** Duration of every scene in frames, in script order. */
export function sceneDurationsInFrames(script: VideoScript, fps: number): number[] {
  return script.scenes.map((scene) => Math.max(1, Math.round(sceneDurationInSeconds(scene) * fps)));
}

/** Frame at which each scene begins. */
export function sceneStartFrames(script: VideoScript, fps: number): number[] {
  const starts: number[] = [];
  let from = 0;
  for (const duration of sceneDurationsInFrames(script, fps)) {
    starts.push(from);
    from += duration;
  }
  return starts;
}

export function totalDurationInFrames(script: VideoScript, fps: number): number {
  return sceneDurationsInFrames(script, fps).reduce((sum, d) => sum + d, 0);
}

/** Index of the scene playing at `frame`; clamps to the first and last scene. */
export function sceneIndexAtFrame(starts: number[], frame: number): number {
  if (starts.length === 0) return 0;
  let index = 0;
  for (let i = 0; i < starts.length; i += 1) {
    if (frame >= starts[i]) index = i;
    else break;
  }
  return index;
}

/** mm:ss for a frame count. */
export function formatFrames(frames: number, fps: number): string {
  const totalSeconds = Math.round(frames / fps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
