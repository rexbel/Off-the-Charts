import { MongoClient, type Collection, type Db, type Document } from "mongodb";
import type {
  AuditEventDoc,
  OutboxDeliveryDoc,
  PatientCheckinDoc,
  PatientContextDoc,
  PersonaRunDoc,
  RewriteDoc,
  SessionDoc,
  TouchpointDoc,
  UserDoc,
} from "./schema";

/**
 * MongoDB connection (MONGODB_URI, database MONGODB_DB or "offthechart").
 * One client per process, kept on globalThis so dev hot reloads don't leak
 * connections.
 */
const globalForMongo = globalThis as unknown as { otcMongo?: Promise<MongoClient> };

function client(): Promise<MongoClient> {
  if (!globalForMongo.otcMongo) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set. Point it at a MongoDB deployment (Atlas or a local mongod).");
    globalForMongo.otcMongo = new MongoClient(uri, { appName: "off-the-chart" }).connect().catch((err) => {
      globalForMongo.otcMongo = undefined;
      throw err;
    });
  }
  return globalForMongo.otcMongo;
}

async function database(): Promise<Db> {
  return (await client()).db(process.env.MONGODB_DB || "offthechart");
}

/** Reads never return Mongo's own `_id`. */
export const noId = { projection: { _id: 0 } } as const;

export type Collections = {
  patientContexts: Collection<PatientContextDoc>;
  personaRuns: Collection<PersonaRunDoc>;
  touchpoints: Collection<TouchpointDoc>;
  auditEvents: Collection<AuditEventDoc>;
  users: Collection<UserDoc>;
  sessions: Collection<SessionDoc>;
  patientCheckins: Collection<PatientCheckinDoc>;
  outboxDeliveries: Collection<OutboxDeliveryDoc>;
  rewrites: Collection<RewriteDoc>;
};

const NAMES: Record<keyof Collections, string> = {
  patientContexts: "patient_contexts",
  personaRuns: "persona_runs",
  touchpoints: "touchpoints",
  auditEvents: "audit_events",
  users: "users",
  sessions: "sessions",
  patientCheckins: "patient_checkins",
  outboxDeliveries: "outbox_deliveries",
  rewrites: "rewrites",
};

let prepared: Promise<Collections> | null = null;

/**
 * The typed collections, with indexes created once per process. Called by the
 * data services before their first query so a fresh database works with no setup.
 */
export function ready(): Promise<Collections> {
  if (!prepared) {
    prepared = (async () => {
      const db = await database();
      const c = Object.fromEntries(Object.entries(NAMES).map(([key, name]) => [key, db.collection<Document>(name)])) as unknown as Collections;
      await Promise.all([
        c.patientContexts.createIndex({ patientId: 1 }, { unique: true }),
        c.personaRuns.createIndex({ id: 1 }, { unique: true }),
        c.personaRuns.createIndex({ patientId: 1, createdAt: -1 }),
        c.personaRuns.createIndex({ namespace: 1, createdAt: -1 }),
        c.touchpoints.createIndex({ id: 1 }, { unique: true }),
        c.touchpoints.createIndex({ runId: 1 }),
        c.touchpoints.createIndex({ namespace: 1, status: 1 }),
        c.auditEvents.createIndex({ at: -1 }),
        c.auditEvents.createIndex({ patientId: 1, at: -1 }),
        c.users.createIndex({ id: 1 }, { unique: true }),
        c.users.createIndex({ email: 1 }, { unique: true }),
        c.sessions.createIndex({ id: 1 }, { unique: true }),
        c.patientCheckins.createIndex({ id: 1 }, { unique: true }),
        c.patientCheckins.createIndex({ token: 1 }, { unique: true }),
        c.patientCheckins.createIndex({ patientId: 1, createdAt: -1 }),
        c.outboxDeliveries.createIndex({ touchpointId: 1 }),
        c.outboxDeliveries.createIndex({ namespace: 1, at: -1 }),
        c.rewrites.createIndex({ patientId: 1, namespace: 1, at: -1 }),
      ]);
      return c;
    })().catch((err) => {
      prepared = null;
      throw err;
    });
  }
  return prepared;
}
