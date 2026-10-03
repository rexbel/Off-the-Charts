import { handle, json } from "@/lib/http";
import { resetAll } from "@/lib/services/demo";

export async function POST() {
  return handle(async () => json(await resetAll()));
}
