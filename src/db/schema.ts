import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

/**
 * Persistence for the mutable parts of the app. The EHR cohort itself is
 * static JSON (src/lib/data/cohort.json); only what a coordinator changes or
 * what the pipeline produces is stored here. Synthetic data only.
 */

export const patientContexts = sqliteTable("patient_contexts", {
  patientId: integer("patient_id").primaryKey(),
  checkin: text("checkin").notNull(),
  audience: text("audience").notNull(),
  language: text("language").notNull(),
  channel: text("channel").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const personaRuns = sqliteTable(
  "persona_runs",
  {
    id: text("id").primaryKey(),
    patientId: integer("patient_id").notNull(),
    namespace: text("namespace").notNull().default("live"),
    createdAt: text("created_at").notNull(),
    source: text("source").notNull(),
    approvedAt: text("approved_at"),
    approvedBy: text("approved_by"),
    /** Full PersonaRun JSON (facts, profile, voice guide, outputs, scores, stages). */
    payload: text("payload").notNull(),
    confirmedClaimIds: text("confirmed_claim_ids").notNull().default("[]"),
  },
  (t) => [index("persona_runs_patient_idx").on(t.patientId, t.createdAt), index("persona_runs_ns_idx").on(t.namespace)],
);

export const touchpoints = sqliteTable(
  "touchpoints",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    patientId: integer("patient_id").notNull(),
    namespace: text("namespace").notNull().default("live"),
    kind: text("kind").notNull(),
    recipient: text("recipient").notNull(),
    status: text("status").notNull(),
    text: text("text").notNull(),
    originalText: text("original_text").notNull(),
    decidedAt: text("decided_at"),
    note: text("note"),
    preparedBy: text("prepared_by"),
    approvedBy: text("approved_by"),
    sentAt: text("sent_at"),
  },
  (t) => [index("touchpoints_run_idx").on(t.runId), index("touchpoints_status_idx").on(t.status), index("touchpoints_ns_idx").on(t.namespace)],
);

/** Audit trail. Never stores message text or note text, only ids and counts. */
export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  at: text("at").notNull(),
  action: text("action").notNull(),
  actorId: text("actor_id"),
  patientId: integer("patient_id"),
  runId: text("run_id"),
  touchpointId: text("touchpoint_id"),
  meta: text("meta").notNull().default("{}"),
});

/** Seeded staff accounts. Passwords are scrypt hashes; never plaintext. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
});

/** Patient-facing check-in links. The token is the only credential; answers are patient-stated. */
export const patientCheckins = sqliteTable(
  "patient_checkins",
  {
    id: text("id").primaryKey(),
    patientId: integer("patient_id").notNull(),
    token: text("token").notNull().unique(),
    status: text("status").notNull(),
    answers: text("answers"),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    submittedAt: text("submitted_at"),
  },
  (t) => [index("patient_checkins_patient_idx").on(t.patientId, t.createdAt)],
);

/** Simulated sends. A vendor adapter would write vendorRef here. */
export const outboxDeliveries = sqliteTable(
  "outbox_deliveries",
  {
    id: text("id").primaryKey(),
    touchpointId: text("touchpoint_id").notNull(),
    patientId: integer("patient_id").notNull(),
    namespace: text("namespace").notNull().default("live"),
    channel: text("channel").notNull(),
    status: text("status").notNull(),
    reason: text("reason"),
    vendorRef: text("vendor_ref"),
    at: text("at").notNull(),
  },
  (t) => [index("outbox_deliveries_tp_idx").on(t.touchpointId), index("outbox_deliveries_ns_idx").on(t.namespace, t.at)],
);
