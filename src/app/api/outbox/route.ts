import { handle, json } from "@/lib/http";
import { outbox } from "@/lib/services/outbox";

export async function GET() {
  return handle(async () => json(await outbox()));
}
