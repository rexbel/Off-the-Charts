/**
 * Generates the illustrations for the visit videos with the OpenAI image API.
 *
 *   backdrops  public/video/scenes/<key>.webp  one character scene per age band
 *              (greeting moments); people sit on the right so chat bubbles fit left.
 *   spots      public/video/spots/<key>.webp   one illustration per idea (calendar,
 *              vitals, echo, phone call...) reused across patients.
 *
 * Characters are stylized and generic: prompts never mention race, ethnicity or a
 * real person, and images contain no text.
 *
 *   pnpm gen-scenes                 # backdrops and spots, skip existing
 *   pnpm gen-scenes spots           # only spots
 *   pnpm gen-scenes adult vitals    # specific keys
 *   pnpm gen-scenes --force ...     # overwrite
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const text = await readFile(path.join(process.cwd(), name), "utf8").catch(() => "");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const LOOK =
  "Flat 2D comic illustration with thick dark outlines, cel shading, subtle halftone dot texture, bright saturated but warm colors, clean vector look, friendly expressive faces, warm daylight. " +
  "Absolutely no text, letters, numbers, signs, labels, logos, speech bubbles or emoji anywhere in the image. Landscape 3:2.";

const BACKDROP_LAYOUT =
  "Composition: wide establishing shot from a few meters away. All people are small enough to fit entirely inside the RIGHTMOST 40 percent of the frame, seated at the far right end of a long bench; no part of any face or head crosses the vertical center line. " +
  "The LEFT 60 percent of the frame is open sky, distant trees, lawn and an empty stretch of the same bench, with no people or objects, left empty for overlaid chat bubbles.";

const SPOT_LAYOUT =
  "Composition: a single clear moment, subject centered and large, simple uncluttered background; keep the top-left corner and the bottom fifth of the frame plain (wall, floor or sky) with no faces, for overlaid labels and captions.";

export const BACKDROPS: Record<string, string> = {
  child: "A cheerful child about eight years old and a parent sitting together on a wooden park bench, the parent holding a smartphone so both can see it.",
  teen: "A relaxed teenager with headphones around the neck sitting on a wooden park bench, looking at a smartphone.",
  young_adult: "A young adult in a hoodie sitting cross-legged on a wooden park bench in a city park, looking at a smartphone.",
  adult: "An adult in a cardigan sitting on a wooden park bench under a leafy tree, looking at a smartphone.",
  midlife: "A middle-aged adult in a light jacket sitting on a wooden park bench, reading glasses on, looking at a smartphone.",
  older_adult: "An older adult with silver hair sitting on a wooden park bench next to an adult family member who is holding a smartphone so both can see it.",
};

/** One idea per illustration. Keys are matched to scene text in src/remotion/spots.ts. */
export const SPOTS: Record<string, string> = {
  calendar: "A big friendly paper wall calendar with one day circled by a thick marker, next to a round alarm clock and a small potted plant on a desk. No numbers or writing on the calendar, just blank squares.",
  arrive: "The bright, calm entrance of a small neighborhood clinic with glass doors, plants and a bench, morning light, a person walking in with a relaxed smile.",
  front_desk: "A friendly receptionist at a rounded clinic front desk waving hello to an arriving patient, plants and soft lighting, calm waiting area behind.",
  vitals: "A kind nurse gently placing a blood pressure cuff on the upper arm of a seated, relaxed patient in a bright exam room, both smiling.",
  heart_scan: "A calm patient lying comfortably on an exam table while a technician holds an ultrasound probe and points at a monitor showing a simple red heart shape, soft lighting, reassuring mood.",
  blood_test: "A nurse with gloves taking a small blood sample from the arm of a calm seated patient who is looking away and breathing slowly, a small adhesive bandage ready on the tray.",
  talk_team: "A clinician in a white coat and a patient sitting face to face in two armchairs having a friendly conversation, the clinician gesturing with an open hand, the patient nodding, a small plant and a window behind. No paper, no documents, no screens.",
  bring_someone: "Two people walking together arm in arm along a sunny tree-lined path, one gently supporting the other, warm and caring mood. No buildings, no doors, no signs.",
  quiet_room: "A quiet, softly lit private waiting room with a comfortable armchair, a plant, a window and a glass of water on a side table, one person sitting calmly with eyes closed taking a breath.",
  phone_call: "Split-screen comic panel divided by a jagged zigzag line: on the left a patient at home smiling while talking on a smartphone, on the right a friendly nurse wearing a headset at a clinic desk talking back.",
  medicines: "A weekly pill organizer with colorful compartments, a glass of water and a small succulent on a kitchen counter in morning light, a hand reaching for the organizer.",
  home_rest: "A person resting comfortably on a sofa under a blanket at home with a cup of tea, a smartphone on the side table, cozy calm afternoon light.",
  questions: "A person at a kitchen table writing a short list on a notepad, thoughtful expression, pen raised, a cup of tea nearby. The notepad shows only scribble lines, no readable writing.",
  family_support: "A family of three generations sitting together on a living room couch, looking at a tablet together, warm supportive mood.",
  walk_outside: "A person taking a gentle walk on a park path on a sunny day, relaxed posture, trees and a pond.",
};

async function generate(prompt: string, apiKey: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1536x1024", quality: "medium", output_format: "webp", output_compression: 70, n: 1 }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`image request failed (${res.status})`);
  const data = (await res.json()) as { data: { b64_json: string }[] };
  return Buffer.from(data.data[0].b64_json, "base64");
}

async function main() {
  await loadEnv();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set.");
    process.exit(1);
  }
  const argv = process.argv.slice(2);
  const force = argv.includes("--force");
  const names = argv.filter((a) => !a.startsWith("--"));
  type Job = { key: string; prompt: string; dir: string };
  const all: Job[] = [
    ...Object.entries(BACKDROPS).map(([key, d]) => ({ key, prompt: `${d} ${BACKDROP_LAYOUT} ${LOOK}`, dir: "scenes" })),
    ...Object.entries(SPOTS).map(([key, d]) => ({ key, prompt: `${d} ${SPOT_LAYOUT} ${LOOK}`, dir: "spots" })),
  ];
  const jobs =
    names.length === 0
      ? all
      : names.includes("spots")
        ? all.filter((j) => j.dir === "spots")
        : names.includes("backdrops")
          ? all.filter((j) => j.dir === "scenes")
          : all.filter((j) => names.includes(j.key));
  if (names.length && jobs.length === 0) {
    console.error(`unknown keys; known: ${all.map((j) => j.key).join(", ")}`);
    process.exit(1);
  }
  for (const job of jobs) {
    const dir = path.join(process.cwd(), "public", "video", job.dir);
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${job.key}.webp`);
    if (!force && (await readFile(file).catch(() => null))) {
      console.log(`  ${job.dir}/${job.key}: exists, skip`);
      continue;
    }
    process.stdout.write(`  ${job.dir}/${job.key}: generating… `);
    const t0 = Date.now();
    try {
      const img = await generate(job.prompt, apiKey);
      await writeFile(file, img);
      console.log(`ok (${Math.round(img.length / 1024)} KB, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    } catch (err) {
      console.log(`failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
