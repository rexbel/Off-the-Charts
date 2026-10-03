import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  factSchema,
  patientContextSchema,
  personaProfileSchema,
  renderedOutputsSchema,
  voiceGuideSchema,
} from "@/lib/schemas";

/**
 * Precomputed model output per patient (scripts/precompute.ts writes these).
 * Used when the model is unavailable or when a build runs in "cached" mode
 * (the guided demo). The UI labels it "Cached output".
 */
export const cachedRunSchema = z.object({
  patientId: z.number(),
  generatedAt: z.string(),
  model: z.string(),
  context: patientContextSchema,
  facts: z.array(factSchema),
  profile: personaProfileSchema,
  voiceGuide: voiceGuideSchema,
  outputs: renderedOutputsSchema,
});
export type CachedRun = z.infer<typeof cachedRunSchema>;

export const GENERATED_DIR = path.join(process.cwd(), "src", "lib", "data", "generated");

export async function loadCachedRun(patientId: number): Promise<CachedRun | null> {
  try {
    const raw = await readFile(path.join(GENERATED_DIR, `${patientId}.json`), "utf8");
    const parsed = cachedRunSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
