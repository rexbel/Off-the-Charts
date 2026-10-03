import cohortJson from "./cohort.json";
import { patientRecordSchema, type PatientRecord } from "@/lib/schemas";

/**
 * The synthetic cohort: 20 patients from sparkcpark/synthetic_hospital v1.3
 * plus a seeded persona layer (names, visits, caregivers, check-ins).
 * Nothing here is a real person.
 */
let cache: PatientRecord[] | null = null;

export function listPatients(): PatientRecord[] {
  if (!cache) {
    cache = (cohortJson as unknown[]).map((raw) => patientRecordSchema.parse(raw));
  }
  return cache;
}

export function getPatient(patientId: number): PatientRecord | undefined {
  return listPatients().find((p) => p.patientId === patientId);
}

export function parsePatientId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** The three seeded demo cases, in walkthrough order. */
export const DEMO_PATIENT_IDS = { ideal: 1672, complex: 2311, edge: 2544 } as const;
