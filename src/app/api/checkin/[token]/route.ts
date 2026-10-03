import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, HttpError, json } from "@/lib/http";
import { getPatient } from "@/lib/data/cohort";
import { checkinAnswersSchema, type PatientCheckin } from "@/lib/schemas";
import { getContext } from "@/lib/services/context";
import { getCheckinByToken, submitCheckin } from "@/lib/services/checkins";
import type { CheckinPublic } from "@/lib/client/api";

/**
 * Patient-facing, no sign-in: the token is the credential. Responses never
 * echo the answers back, and the body is capped at 8 KB so this endpoint is
 * cheap to rate-limit upstream.
 */
const MAX_BODY_BYTES = 8 * 1024;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{16,128}$/;

const submitBodySchema = z.object({ answers: checkinAnswersSchema });

async function loadByToken(token: string): Promise<PatientCheckin> {
  if (!TOKEN_SHAPE.test(token)) throw new HttpError(404, "Check-in link not found");
  const checkin = await getCheckinByToken(token);
  if (!checkin) throw new HttpError(404, "Check-in link not found");
  return checkin;
}

async function toPublic(checkin: PatientCheckin): Promise<CheckinPublic> {
  const patient = getPatient(checkin.patientId);
  if (!patient) throw new HttpError(404, "Check-in link not found");
  const { context } = await getContext(patient);
  return { status: checkin.status, expiresAt: checkin.expiresAt, patientFirstName: patient.seed.preferredName, language: context.language };
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/checkin/[token]">) {
  return handle(async () => {
    const { token } = await ctx.params;
    const checkin = await loadByToken(token);
    return json({ checkin: await toPublic(checkin) });
  });
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/checkin/[token]">) {
  return handle(async () => {
    const { token } = await ctx.params;
    if (!TOKEN_SHAPE.test(token)) throw new HttpError(404, "Check-in link not found");

    const declared = Number(req.headers.get("content-length") ?? "0");
    if (declared > MAX_BODY_BYTES) throw new HttpError(413, "Your answers are too long. Please shorten them.");
    const text = await req.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new HttpError(413, "Your answers are too long. Please shorten them.");

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new HttpError(400, "Request body must be JSON");
    }
    const { answers } = submitBodySchema.parse(raw);
    const checkin = await submitCheckin(token, answers);
    return json({ checkin: { status: checkin.status, submittedAt: checkin.submittedAt } });
  });
}
