import { handle, json } from "@/lib/http";
import { patientSummaries } from "@/lib/services/patients";

export async function GET() {
  return handle(async () => json({ patients: await patientSummaries() }));
}
