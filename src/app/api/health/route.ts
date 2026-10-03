import { readdir } from "node:fs/promises";
import { handle, json } from "@/lib/http";
import { modelAvailable, modelId, providerName } from "@/lib/ai/provider";
import { GENERATED_DIR } from "@/lib/pipeline/cached";
import { demoEnabled } from "@/lib/namespace";

export async function GET() {
  return handle(async () => {
    const cached = await readdir(GENERATED_DIR).catch(() => [] as string[]);
    return json({ ok: true, modelAvailable: modelAvailable(), provider: providerName(), model: modelId(), cachedPatients: cached.filter((f) => f.endsWith(".json")).length, demoEnabled: demoEnabled() });
  });
}
