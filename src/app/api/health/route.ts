import { readdir } from "node:fs/promises";
import { handle, json } from "@/lib/http";
import { modelAvailable, modelId } from "@/lib/ai/provider";
import { GENERATED_DIR } from "@/lib/pipeline/cached";

export async function GET() {
  return handle(async () => {
    const cached = await readdir(GENERATED_DIR).catch(() => [] as string[]);
    return json({ ok: true, modelAvailable: modelAvailable(), model: modelId(), cachedPatients: cached.filter((f) => f.endsWith(".json")).length });
  });
}
