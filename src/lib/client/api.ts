import type {
  ApiError,
  AuditEvent,
  LoginRequest,
  Namespace,
  OutboxDelivery,
  QueueItem,
  SendRequest,
  User,
  BuildEvent,
  BuildRequest,
  OutboxMetrics,
  PatientContext,
  PatientRecord,
  PatientSummary,
  PersonaRun,
  RewriteRequest,
  RewriteRecord,
  RewriteResponse,
  TiScore,
  Touchpoint,
  TouchpointAction,
  CheckinAnswers,
  CheckinStatus,
  Language,
  PatientCheckin,
} from "@/lib/schemas";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) {
    let body: ApiError | null = null;
    try {
      body = (await res.json()) as ApiError;
    } catch {
      /* non-JSON error */
    }
    throw new ApiRequestError(res.status, body?.error ?? `Request failed (${res.status})`, body?.details);
  }
  return (await res.json()) as T;
}

export type PatientBundle = {
  patient: PatientRecord;
  context: PatientContext;
  contextEdited: boolean;
  latest: { run: PersonaRun; touchpoints: Touchpoint[] } | null;
  runs: Pick<PersonaRun, "id" | "createdAt" | "source" | "approvedAt">[];
  cachedAvailable: boolean;
  modelAvailable: boolean;
  namespace: Namespace;
};

export const api = {
  me: () => request<{ user: User | null; namespace: Namespace; demoEnabled: boolean }>("/api/me"),
  login: (body: LoginRequest) => request<{ user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  queue: () => request<{ items: QueueItem[] }>("/api/queue"),
  audit: (patientId?: number) => request<{ events: AuditEvent[] }>(`/api/audit${patientId ? `?patientId=${patientId}` : ""}`),
  send: (body: SendRequest) => request<{ deliveries: OutboxDelivery[] }>("/api/outbox/send", { method: "POST", body: JSON.stringify(body) }),
  demoStart: () => request<{ namespace: Namespace }>("/api/demo/start", { method: "POST" }),
  demoExit: () => request<{ namespace: Namespace }>("/api/demo/exit", { method: "POST" }),
  patients: () => request<{ patients: PatientSummary[] }>("/api/patients"),
  patient: (id: number) => request<PatientBundle>(`/api/patients/${id}`),
  saveContext: (id: number, context: PatientContext) => request<{ context: PatientContext; contextEdited: boolean }>(`/api/patients/${id}/context`, { method: "PUT", body: JSON.stringify(context) }),
  resetContext: (id: number) => request<{ context: PatientContext; contextEdited: boolean }>(`/api/patients/${id}/context`, { method: "DELETE" }),
  run: (runId: string) => request<{ run: PersonaRun; touchpoints: Touchpoint[] }>(`/api/runs/${runId}`),
  confirmClaim: (runId: string, claimId: string) => request<{ confirmedClaimIds: string[] }>(`/api/runs/${runId}/claims/${claimId}/confirm`, { method: "POST" }),
  touchpoint: (id: string, action: TouchpointAction) => request<{ touchpoint: Touchpoint; score: TiScore }>(`/api/touchpoints/${id}`, { method: "POST", body: JSON.stringify(action) }),
  rewrite: (body: RewriteRequest) => request<RewriteResponse>("/api/rewrite", { method: "POST", body: JSON.stringify(body) }),
  rewrites: (patientId: number) => request<{ rewrites: RewriteRecord[] }>(`/api/rewrite?patientId=${patientId}`),
  outbox: () => request<{ approved: Touchpoint[]; metrics: OutboxMetrics; deliveries: Record<string, OutboxDelivery> }>("/api/outbox"),
  resetDemo: () => request<{ runs: number; touchpoints: number; deliveries: number }>("/api/demo/reset", { method: "POST" }),
  checkins: (patientId: number) => request<{ checkins: PatientCheckin[] }>(`/api/patients/${patientId}/checkins`),
  createCheckin: (patientId: number) => request<{ checkin: PatientCheckin }>(`/api/patients/${patientId}/checkins`, { method: "POST" }),
  checkinStatus: (token: string) => request<{ checkin: CheckinPublic }>(`/api/checkin/${encodeURIComponent(token)}`),
  checkinSubmit: (token: string, answers: CheckinAnswers) =>
    request<{ checkin: { status: CheckinStatus; submittedAt: string | null } }>(`/api/checkin/${encodeURIComponent(token)}`, { method: "POST", body: JSON.stringify({ answers }) }),
};

/** What the patient-facing GET /api/checkin/[token] returns. Never includes the answers. */
export type CheckinPublic = { status: CheckinStatus; expiresAt: string; patientFirstName: string; language: Language };

/**
 * Streams the build. Resolves when the stream ends; every parsed line is
 * handed to onEvent in order. Rejects only on transport failure.
 */
export async function streamBuild(patientId: number, body: BuildRequest, onEvent: (e: BuildEvent) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch(`/api/patients/${patientId}/build`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = `Build request failed (${res.status})`;
    try {
      message = ((await res.json()) as ApiError).error ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiRequestError(res.status, message);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf("\n");
    while (nl >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as BuildEvent);
      nl = buffer.indexOf("\n");
    }
  }
  const tail = buffer.trim();
  if (tail) onEvent(JSON.parse(tail) as BuildEvent);
}
