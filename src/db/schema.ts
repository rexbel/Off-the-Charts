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
    createdAt: text("created_at").notNull(),
    source: text("source").notNull(),
    /** Full PersonaRun JSON (facts, profile, voice guide, outputs, scores, stages). */
    payload: text("payload").notNull(),
    confirmedClaimIds: text("confirmed_claim_ids").notNull().default("[]"),
  },
  (t) => [index("persona_runs_patient_idx").on(t.patientId, t.createdAt)],
);

export const touchpoints = sqliteTable(
  "touchpoints",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    patientId: integer("patient_id").notNull(),
    kind: text("kind").notNull(),
    recipient: text("recipient").notNull(),
    status: text("status").notNull(),
    text: text("text").notNull(),
    originalText: text("original_text").notNull(),
    decidedAt: text("decided_at"),
    note: text("note"),
  },
  (t) => [index("touchpoints_run_idx").on(t.runId), index("touchpoints_status_idx").on(t.status)],
);

/** Audit trail. Never stores message text or note text, only ids and counts. */
export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  at: text("at").notNull(),
  action: text("action").notNull(),
  patientId: integer("patient_id"),
  runId: text("run_id"),
  touchpointId: text("touchpoint_id"),
  meta: text("meta").notNull().default("{}"),
});
