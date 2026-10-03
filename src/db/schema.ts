/**
 * Persistence for the mutable parts of the app, one MongoDB collection per
 * document type. The EHR cohort itself is static JSON (src/lib/data/cohort.json);
 * only what a coordinator changes or what the pipeline produces is stored here.
 * Synthetic data only. Every document carries its own string `id` (unique index);
 * Mongo's `_id` is never read back.
 */

export type PatientContextDoc = {
  patientId: number;
  checkin: string;
  audience: string;
  language: string;
  channel: string;
  updatedAt: string;
};

export type PersonaRunDoc = {
  id: string;
  patientId: number;
  namespace: string;
  createdAt: string;
  source: string;
  approvedAt: string | null;
  approvedBy: string | null;
  /** Full PersonaRun JSON (facts, profile, voice guide, outputs, scores, stages). */
  payload: string;
  confirmedClaimIds: string;
};

export type TouchpointDoc = {
  id: string;
  runId: string;
  patientId: number;
  namespace: string;
  kind: string;
  recipient: string;
  status: string;
  text: string;
  originalText: string;
  decidedAt: string | null;
  note: string | null;
  preparedBy: string | null;
  approvedBy: string | null;
  sentAt: string | null;
};

/** Audit trail. Never stores message text or note text, only ids and counts. */
export type AuditEventDoc = {
  id: string;
  at: string;
  action: string;
  actorId: string | null;
  patientId: number | null;
  runId: string | null;
  touchpointId: string | null;
  meta: string;
};

/** Seeded staff accounts. Passwords are scrypt hashes; never plaintext. */
export type UserDoc = {
  id: string;
  email: string;
  name: string;
  role: string;
  passwordHash: string;
  createdAt: string;
};

export type SessionDoc = {
  id: string;
  userId: string;
  expiresAt: string;
};

/** Patient-facing check-in links. The token is the only credential; answers are patient-stated. */
export type PatientCheckinDoc = {
  id: string;
  patientId: number;
  token: string;
  status: string;
  answers: string | null;
  createdAt: string;
  expiresAt: string;
  submittedAt: string | null;
};

/** Simulated sends. A vendor adapter would write vendorRef here. */
export type OutboxDeliveryDoc = {
  id: string;
  touchpointId: string;
  patientId: number;
  namespace: string;
  channel: string;
  status: string;
  reason: string | null;
  vendorRef: string | null;
  at: string;
};

/** Rewrite-tool history per patient. Stores the rewritten message (it is a draft message, not chart text). */
export type RewriteDoc = {
  id: string;
  patientId: number;
  namespace: string;
  actorId: string | null;
  source: string;
  stage: string;
  original: string;
  rewritten: string;
  beforeScore: number;
  afterScore: number;
  at: string;
};
