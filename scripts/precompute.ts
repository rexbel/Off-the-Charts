/**
 * Precompute live model output for every patient (or the ids given) into
 * src/lib/data/generated/<id>.json. These files are the "Cached output"
 * fallback and what the guided walkthrough replays.
 *
 *   pnpm precompute            # all 20
 *   pnpm precompute 1672 2311  # some
 *   pnpm precompute --force    # overwrite existing files
 *   pnpm precompute --check    # exit 1 if any patient lacks a valid cached file (no model calls)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Minimal .env loader (no extra dependency): .env.local then .env, never overriding the shell. */
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

async function main() {
  await loadEnv();
  const { listPatients } = await import("@/lib/data/cohort");
  const { runPipeline } = await import("@/lib/pipeline/run");
  const { defaultContext } = await import("@/lib/services/context");
  const { GENERATED_DIR, cachedRunSchema } = await import("@/lib/pipeline/cached");
  const { modelAvailable, modelId } = await import("@/lib/ai/provider");
  const argv = process.argv.slice(2);

  if (argv.includes("--check")) {
    let missing = 0;
    for (const p of listPatients()) {
      const file = path.join(GENERATED_DIR, `${p.patientId}.json`);
      const raw = await readFile(file, "utf8").catch(() => null);
      const ok = raw ? cachedRunSchema.safeParse(JSON.parse(raw)).success : false;
      if (!ok) {
        missing += 1;
        console.log(`  ${p.patientId} ${p.seed.preferredName}: ${raw ? "does not match the schema" : "missing"}`);
      }
    }
    console.log(missing ? `${missing} patient(s) without valid cached output.` : "All 20 patients have valid cached output.");
    process.exit(missing ? 1 : 0);
  }

  if (!modelAvailable()) {
    console.error("No ANTHROPIC_API_KEY (or ant auth profile). Precompute needs the live model.");
    process.exit(1);
  }
  const args = argv;
  const force = args.includes("--force");
  const ids = args.filter((a) => /^\d+$/.test(a)).map(Number);
  const patients = listPatients().filter((p) => ids.length === 0 || ids.includes(p.patientId));
  await mkdir(GENERATED_DIR, { recursive: true });
  console.log(`Model ${modelId()} · ${patients.length} patient(s) · ${force ? "overwrite" : "skip existing"}`);

  let ok = 0;
  let failed = 0;
  for (const p of patients) {
    const file = path.join(GENERATED_DIR, `${p.patientId}.json`);
    if (!force) {
      const exists = await readFile(file, "utf8").then(() => true).catch(() => false);
      if (exists) {
        console.log(`  ${p.patientId} ${p.seed.preferredName}: exists, skip`);
        continue;
      }
    }
    const t0 = Date.now();
    process.stdout.write(`  ${p.patientId} ${p.seed.preferredName}: `);
    const run = await runPipeline(p, defaultContext(p), () => {}, { mode: "live", cachedStageDelayMs: 0, keepDateTokens: true });
    const live = run.stages.filter((s) => s.stage !== "extract" && s.stage !== "score").every((s) => s.source === "live");
    if (!live) {
      failed += 1;
      console.log(`NOT live (${run.stages.map((s) => `${s.stage}:${s.source}${s.warning ? ` "${s.warning}"` : ""}`).join(", ")}) · not written`);
      continue;
    }
    // Outputs keep their {{date}} tokens; the pipeline fills them at read time so cached text stays current.
    const payload = cachedRunSchema.parse({
      patientId: p.patientId,
      generatedAt: new Date().toISOString(),
      model: run.stages.find((s) => s.model)?.model ?? modelId(),
      context: run.context,
      facts: run.facts,
      profile: run.profile,
      voiceGuide: run.voiceGuide,
      outputs: run.outputs,
    });
    await writeFile(file, JSON.stringify(payload, null, 1) + "\n");
    ok += 1;
    const m = run.scores.messages[1];
    console.log(`ok in ${((Date.now() - t0) / 1000).toFixed(0)}s · 2-day message ${m.generic.score} → ${m.persona.score} · grade ${m.generic.readingGrade} → ${m.persona.readingGrade}`);
  }
  console.log(`Done. ${ok} written, ${failed} not live.`);
  process.exit(failed ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
