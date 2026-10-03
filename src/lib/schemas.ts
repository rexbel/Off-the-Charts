import { z } from "zod";

/**
 * Shared domain contracts for Off the Chart.
 *
 * Everything the pipeline produces, the API returns, and the UI renders is
 * typed here. The LLM stages are validated against these schemas; the
 * deterministic fallback produces the same shapes.
 */

// ---------------------------------------------------------------------------
// Cohort (synthetic patients, src/lib/data/cohort.json)
// ---------------------------------------------------------------------------

export const audienceSchema = z.enum([
  "self",
  "caregiver",
  "care_partner",
  "dual_teen_guardian",
  "dual_child_parent",
  "self_plus_caregiver",
  "multi_caregiver",
  "self_plus_family",
]);
export type Audience = z.infer<typeof audienceSchema>;

export const AUDIENCE_LABEL: Record<Audience, string> = {
  self: "Patient",
  caregiver: "Caregiver",
  care_partner: "Patient + care partner",
  dual_teen_guardian: "Teen + guardian (split)",
  dual_child_parent: "Child + parent",
  self_plus_caregiver: "Patient + caregiver",
  multi_caregiver: "Several caregivers",
  self_plus_family: "Patient + family",
};

export const languageSchema = z.enum(["en", "es"]);
export type Language = z.infer<typeof languageSchema>;

export const channelSchema = z.enum(["sms", "portal", "phone"]);
export type Channel = z.infer<typeof channelSchema>;

export const ageBandSchema = z.enum(["pediatric", "adolescent", "young_adult", "adult", "midlife", "older_adult"]);
export type AgeBand = z.infer<typeof ageBandSchema>;

export const demoRoleSchema = z.enum(["ideal", "complex", "edge"]).nullable();
export type DemoRole = z.infer<typeof demoRoleSchema>;

export const encounterSchema = z.object({
  encounter_id: z.number(),
  encounter_date: z.string(),
  encounter_type: z.string(),
  chief_complaint: z.string(),
  attending_name: z.string(),
  department: z.string(),
  note_text: z.string(),
});
export type Encounter = z.infer<typeof encounterSchema>;

export const ehrRecordSchema = z.object({
  age: z.number(),
  sex: z.string(),
  race_ethnicity: z.string(),
  insurance: z.string(),
  primary_diagnoses: z.array(z.string()),
  comorbidities: z.array(z.string()),
  profile: z.object({
    sex: z.string(),
    allergies: z.array(z.string()),
    insurance: z.string(),
    occupation: z.string(),
    alcohol_use: z.string(),
    family_history: z.array(z.string()),
    race_ethnicity: z.string(),
    smoking_status: z.string(),
    home_medications: z.array(z.object({ dose: z.string(), name: z.string() })),
    surgical_history: z.array(z.string()),
    chronic_conditions: z.array(z.string()),
    age_at_first_encounter: z.number(),
  }),
  encounters: z.array(encounterSchema),
});
export type EhrRecord = z.infer<typeof ehrRecordSchema>;

export const upcomingVisitSchema = z.object({
  department: z.string(),
  reason: z.string(),
  daysUntil: z.number(),
  synthetic: z.literal(true),
});
export type UpcomingVisit = z.infer<typeof upcomingVisitSchema>;

export const patientSeedSchema = z.object({
  displayName: z.string(),
  preferredName: z.string(),
  audience: audienceSchema,
  caregiver: z.string().nullable(),
  personaArchetype: z.string(),
  upcomingVisit: upcomingVisitSchema,
  statedLanguage: languageSchema,
  whatMattersCheckin: z.string(),
  checkinSource: z.string(),
  dementia: z.boolean(),
  ageBand: ageBandSchema,
  demoRole: demoRoleSchema,
});
export type PatientSeed = z.infer<typeof patientSeedSchema>;

export const patientRecordSchema = z.object({
  patientId: z.number(),
  synthetic: z.literal(true),
  seed: patientSeedSchema,
  ehr: ehrRecordSchema,
});
export type PatientRecord = z.infer<typeof patientRecordSchema>;

/** Editable per-patient context the coordinator can change before a build. */
export const patientContextSchema = z.object({
  checkin: z.string().max(2000),
  audience: audienceSchema,
  language: languageSchema,
  channel: channelSchema,
});
export type PatientContext = z.infer<typeof patientContextSchema>;

// ---------------------------------------------------------------------------
// Facts and claims (provenance)
// ---------------------------------------------------------------------------

/** A deterministic extraction from the EHR. Never produced by the model. */
export const factSchema = z.object({
  id: z.string(),
  /** Where in the record this came from, e.g. "primary_diagnoses", "encounter.note_text.assessment". */
  field: z.string(),
  value: z.string(),
  encounterId: z.number().optional(),
  date: z.string().optional(),
});
export type Fact = z.infer<typeof factSchema>;

export const claimKindSchema = z.enum(["fact", "inferred", "patient_stated"]);
export type ClaimKind = z.infer<typeof claimKindSchema>;

export const claimSourceSchema = z.object({
  /** Fact ids this claim rests on. Facts carry the encounter/field. */
  factIds: z.array(z.string()),
  /** Free-text pointer for patient-stated claims (e.g. "What matters check-in"). */
  note: z.string().optional(),
});

export const claimSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: claimKindSchema,
  source: claimSourceSchema,
  /** Required for inferred claims: why the model believes it. */
  reason: z.string().optional(),
});
export type Claim = z.infer<typeof claimSchema>;

export const privacyRuleSchema = z.object({
  id: z.string(),
  /** Plain-language rule, e.g. "Do not name HIV in text messages." */
  rule: z.string(),
  /** Terms that must not appear on the restricted channels/audiences (case-insensitive). */
  restrictedTerms: z.array(z.string()),
  channels: z.array(channelSchema),
  /** Recipient roles this applies to, e.g. ["guardian"]. Empty means all recipients. */
  recipients: z.array(z.string()),
  kind: claimKindSchema,
  source: claimSourceSchema,
  reason: z.string().optional(),
});
export type PrivacyRule = z.infer<typeof privacyRuleSchema>;

// ---------------------------------------------------------------------------
// Persona Profile and Voice Guide
// ---------------------------------------------------------------------------

export const detailPreferenceSchema = z.enum(["brief", "stepwise", "numbers"]);

export const recipientSchema = z.object({
  /** Stable key used in messages, e.g. "patient", "daughter", "guardian". */
  role: z.string(),
  name: z.string().optional(),
  relationship: z.string().optional(),
  primary: z.boolean(),
});
export type Recipient = z.infer<typeof recipientSchema>;

export const personaProfileSchema = z.object({
  patientId: z.number(),
  preferredName: z.string(),
  /** One sentence a coordinator can read in three seconds. */
  summaryLine: z.string(),
  audience: audienceSchema,
  recipients: z.array(recipientSchema).min(1),
  communicationNeeds: z.object({
    readingLevel: z.number().min(2).max(12),
    detailPreference: detailPreferenceSchema,
    language: languageSchema,
    channel: channelSchema,
    bestTimeOfDay: z.string().optional(),
  }),
  emotionalContext: z.array(claimSchema),
  privacyRules: z.array(privacyRuleSchema),
  cognitiveSupport: z.array(claimSchema),
  strengths: z.array(claimSchema),
  avoidTerms: z.array(z.string()),
  dataQualityWarnings: z.array(z.string()),
});
export type PersonaProfile = z.infer<typeof personaProfileSchema>;

export const voiceGuideSchema = z.object({
  tone: z.array(z.string()).min(1),
  doSay: z.array(z.string()),
  dontSay: z.array(z.string()),
  sentenceMaxWords: z.number().min(6).max(30),
  /** e.g. "Speak to Walter first, then Linda." */
  addressing: z.string(),
  greeting: z.string(),
  signoff: z.string(),
  choicePhrases: z.array(z.string()),
  safetyPhrases: z.array(z.string()),
});
export type VoiceGuide = z.infer<typeof voiceGuideSchema>;

// ---------------------------------------------------------------------------
// Rendered outputs
// ---------------------------------------------------------------------------

export const messageStageSchema = z.enum(["before_7d", "before_2d", "after_24h"]);
export type MessageStage = z.infer<typeof messageStageSchema>;

export const MESSAGE_STAGE_LABEL: Record<MessageStage, string> = {
  before_7d: "7 days before",
  before_2d: "2 days before",
  after_24h: "24 hours after",
};

export const renderedMessageSchema = z.object({
  stage: messageStageSchema,
  /** Recipient role from the profile. */
  recipient: z.string(),
  persona: z.string(),
  claimIds: z.array(z.string()),
});
export type RenderedMessage = z.infer<typeof renderedMessageSchema>;

export const clinicianBriefSchema = z.object({
  /** 4-7 short lines, about 75 words total. */
  lines: z.array(z.string()).min(3).max(8),
  readAloudSeconds: z.number(),
  claimIds: z.array(z.string()),
});
export type ClinicianBrief = z.infer<typeof clinicianBriefSchema>;

export const visitSummarySchema = z.object({
  headline: z.string(),
  whatWeTalkedAbout: z.array(z.object({ text: z.string(), claimIds: z.array(z.string()) })),
  yourNextSteps: z.array(z.string()),
  whenToCall: z.array(z.string()),
  questionsForNextTime: z.array(z.string()),
});
export type VisitSummary = z.infer<typeof visitSummarySchema>;

export const sceneKindSchema = z.enum(["title", "card", "steps", "choice", "closing"]);
export const sceneSchema = z.object({
  kind: sceneKindSchema,
  title: z.string().optional(),
  text: z.string(),
  items: z.array(z.string()).optional(),
  voiceover: z.string(),
});
export type Scene = z.infer<typeof sceneSchema>;

export const videoStageSchema = z.enum(["before", "after"]);
export const videoScriptSchema = z.object({
  stage: videoStageSchema,
  title: z.string(),
  scenes: z.array(sceneSchema).min(3).max(7),
});
export type VideoScript = z.infer<typeof videoScriptSchema>;

/** What the render stage returns. */
export const renderedOutputsSchema = z.object({
  messages: z.array(renderedMessageSchema).length(3),
  clinicianBrief: clinicianBriefSchema,
  visitSummary: visitSummarySchema,
  videoScripts: z.array(videoScriptSchema).length(2),
});
export type RenderedOutputs = z.infer<typeof renderedOutputsSchema>;

/** The clinic's existing generic template output, built deterministically. */
export const genericBaselineSchema = z.object({
  messages: z.array(z.object({ stage: messageStageSchema, text: z.string() })).length(3),
  /** After-visit summary pasted from the note at clinical reading level. */
  summary: z.string(),
});
export type GenericBaseline = z.infer<typeof genericBaselineSchema>;

// ---------------------------------------------------------------------------
// Trauma-informed checker
// ---------------------------------------------------------------------------

export const tiRuleSchema = z.enum([
  "reading_level",
  "stigma",
  "choice",
  "predictability",
  "safety",
  "collaboration",
  "privacy",
  "sentence_length",
]);
export type TiRule = z.infer<typeof tiRuleSchema>;

export const tiMatchSchema = z.object({
  term: z.string(),
  suggestion: z.string().optional(),
  index: z.number(),
  length: z.number(),
});
export type TiMatch = z.infer<typeof tiMatchSchema>;

export const tiFindingSchema = z.object({
  rule: tiRuleSchema,
  passed: z.boolean(),
  /** "block" means approval is blocked until resolved (privacy only). */
  severity: z.enum(["block", "warn", "info"]),
  message: z.string(),
  /** Points earned out of pointsAvailable for this rule. */
  points: z.number(),
  pointsAvailable: z.number(),
  matches: z.array(tiMatchSchema),
});
export type TiFinding = z.infer<typeof tiFindingSchema>;

export const tiScoreSchema = z.object({
  score: z.number().min(0).max(100),
  readingGrade: z.number(),
  longestSentenceWords: z.number(),
  blocked: z.boolean(),
  findings: z.array(tiFindingSchema),
});
export type TiScore = z.infer<typeof tiScoreSchema>;

/** What the checker needs to know about the intended reader. */
export const tiTargetSchema = z.object({
  readingLevel: z.number(),
  sentenceMaxWords: z.number(),
  language: languageSchema,
  channel: channelSchema,
  recipient: z.string(),
  privacyRules: z.array(privacyRuleSchema),
  avoidTerms: z.array(z.string()),
});
export type TiTarget = z.infer<typeof tiTargetSchema>;

// ---------------------------------------------------------------------------
// Users, roles, namespaces
// ---------------------------------------------------------------------------

export const roleSchema = z.enum(["coordinator", "clinician", "admin"]);
export type Role = z.infer<typeof roleSchema>;

export const ROLE_LABEL: Record<Role, string> = { coordinator: "Care coordinator", clinician: "Clinician", admin: "Admin" };

export const userSchema = z.object({ id: z.string(), email: z.string(), name: z.string(), role: roleSchema });
export type User = z.infer<typeof userSchema>;

export const loginSchema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });
export type LoginRequest = z.infer<typeof loginSchema>;

/** Demo runs live in their own namespace so the walkthrough never touches real work. */
export const namespaceSchema = z.enum(["live", "demo"]);
export type Namespace = z.infer<typeof namespaceSchema>;

// ---------------------------------------------------------------------------
// Patient check-in intake
// ---------------------------------------------------------------------------

export const checkinStatusSchema = z.enum(["sent", "submitted", "expired"]);
export type CheckinStatus = z.infer<typeof checkinStatusSchema>;

export const bestTimeSchema = z.enum(["morning", "afternoon", "no_preference"]);
export type BestTime = z.infer<typeof bestTimeSchema>;

export const checkinAnswersSchema = z.object({
  whatMatters: z.string().min(1).max(2000),
  language: languageSchema,
  /** Who else should get messages, in the patient's own words. Empty means only the patient. */
  includeWho: z.string().max(120),
  bestTime: bestTimeSchema,
});
export type CheckinAnswers = z.infer<typeof checkinAnswersSchema>;

export const patientCheckinSchema = z.object({
  id: z.string(),
  patientId: z.number(),
  token: z.string(),
  status: checkinStatusSchema,
  answers: checkinAnswersSchema.nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
  submittedAt: z.string().nullable(),
});
export type PatientCheckin = z.infer<typeof patientCheckinSchema>;

// ---------------------------------------------------------------------------
// Outbox deliveries (simulated sending)
// ---------------------------------------------------------------------------

export const deliveryStatusSchema = z.enum(["queued", "sent_simulated", "blocked"]);
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

export const outboxDeliverySchema = z.object({
  id: z.string(),
  touchpointId: z.string(),
  patientId: z.number(),
  namespace: namespaceSchema,
  channel: channelSchema,
  status: deliveryStatusSchema,
  reason: z.string().nullable(),
  /** Simulated vendor reference, e.g. "sim_ab12". */
  vendorRef: z.string().nullable(),
  at: z.string(),
});
export type OutboxDelivery = z.infer<typeof outboxDeliverySchema>;

export const sendRequestSchema = z.object({ touchpointIds: z.array(z.string()).min(1).max(50) });
export type SendRequest = z.infer<typeof sendRequestSchema>;

// ---------------------------------------------------------------------------
// Runs and touchpoints (persisted)
// ---------------------------------------------------------------------------

export const runSourceSchema = z.enum(["live", "cached", "fallback"]);
export type RunSource = z.infer<typeof runSourceSchema>;

export const stageNameSchema = z.enum(["extract", "profile", "voice", "render", "score"]);
export type StageName = z.infer<typeof stageNameSchema>;

export const STAGE_LABEL: Record<StageName, string> = {
  extract: "Extract facts",
  profile: "Persona Profile",
  voice: "Voice Guide",
  render: "Render touchpoints",
  score: "Check and score",
};

export const scoresSchema = z.object({
  messages: z.array(
    z.object({ stage: messageStageSchema, generic: tiScoreSchema, persona: tiScoreSchema }),
  ),
  brief: tiScoreSchema,
  summary: z.object({ generic: tiScoreSchema, persona: tiScoreSchema }),
});
export type Scores = z.infer<typeof scoresSchema>;

export const stageMetaSchema = z.object({
  stage: stageNameSchema,
  source: runSourceSchema,
  durationMs: z.number(),
  model: z.string().optional(),
  warning: z.string().optional(),
});

export const personaRunSchema = z.object({
  id: z.string(),
  patientId: z.number(),
  createdAt: z.string(),
  namespace: namespaceSchema.default("live"),
  /** Set when a clinician approves a touchpoint of this run: the "latest approved" marker. */
  approvedAt: z.string().nullable().default(null),
  approvedBy: z.string().nullable().default(null),
  /** Overall: "live" only when every model stage was live. */
  source: runSourceSchema,
  context: patientContextSchema,
  facts: z.array(factSchema),
  profile: personaProfileSchema,
  voiceGuide: voiceGuideSchema,
  outputs: renderedOutputsSchema,
  generic: genericBaselineSchema,
  scores: scoresSchema,
  stages: z.array(stageMetaSchema),
  confirmedClaimIds: z.array(z.string()),
});
export type PersonaRun = z.infer<typeof personaRunSchema>;

export const touchpointKindSchema = z.enum([
  "message_before_7d",
  "message_before_2d",
  "message_after_24h",
  "brief",
  "summary",
  "video_before",
  "video_after",
]);
export type TouchpointKind = z.infer<typeof touchpointKindSchema>;

export const TOUCHPOINT_LABEL: Record<TouchpointKind, string> = {
  message_before_7d: "Message · 7 days before",
  message_before_2d: "Message · 2 days before",
  message_after_24h: "Message · 24 hours after",
  brief: "Clinician brief",
  summary: "Visit summary",
  video_before: "Video · before your visit",
  video_after: "Video · after your visit",
};

export const touchpointStatusSchema = z.enum(["pending", "approved", "edited", "rejected"]);
export type TouchpointStatus = z.infer<typeof touchpointStatusSchema>;

export const touchpointSchema = z.object({
  id: z.string(),
  runId: z.string(),
  patientId: z.number(),
  namespace: namespaceSchema.default("live"),
  kind: touchpointKindSchema,
  recipient: z.string(),
  status: touchpointStatusSchema,
  /** Current text (edited text when status is "edited"). */
  text: z.string(),
  originalText: z.string(),
  decidedAt: z.string().nullable(),
  note: z.string().nullable(),
  preparedBy: z.string().nullable().default(null),
  approvedBy: z.string().nullable().default(null),
  sentAt: z.string().nullable().default(null),
});
export type Touchpoint = z.infer<typeof touchpointSchema>;

/** One row of the cross-patient approval queue. */
export type QueueItem = { touchpoint: Touchpoint; patientName: string; runSource: RunSource; runCreatedAt: string; blocked: boolean; score: number };

export type AuditEvent = {
  id: string;
  at: string;
  action: string;
  actorId: string | null;
  actorName: string | null;
  patientId: number | null;
  runId: string | null;
  touchpointId: string | null;
  meta: Record<string, string | number | boolean | null>;
};

export const touchpointActionSchema = z.object({
  action: z.enum(["approve", "reject", "edit", "reset"]),
  text: z.string().max(4000).optional(),
  note: z.string().max(500).optional(),
});
export type TouchpointAction = z.infer<typeof touchpointActionSchema>;

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

export const buildModeSchema = z.enum(["live", "cached"]);
export type BuildMode = z.infer<typeof buildModeSchema>;

export const buildRequestSchema = z.object({
  mode: buildModeSchema.default("live"),
  context: patientContextSchema.optional(),
});
export type BuildRequest = z.infer<typeof buildRequestSchema>;

/** NDJSON events streamed by POST /api/patients/[id]/build. */
export type BuildEvent =
  | { type: "stage"; stage: StageName; status: "start" }
  | {
      type: "stage";
      stage: StageName;
      status: "done";
      source: RunSource;
      durationMs: number;
      /** Partial result for the UI: facts, profile, voiceGuide, outputs or scores. */
      data: unknown;
      warning?: string;
    }
  | { type: "complete"; run: PersonaRun; touchpoints: Touchpoint[] }
  | { type: "error"; message: string };

export const rewriteRequestSchema = z.object({
  patientId: z.number(),
  text: z.string().min(1).max(2000),
  stage: messageStageSchema.default("before_2d"),
});
export type RewriteRequest = z.infer<typeof rewriteRequestSchema>;

export const rewriteResponseSchema = z.object({
  source: runSourceSchema,
  original: z.string(),
  rewritten: z.string(),
  before: tiScoreSchema,
  after: tiScoreSchema,
  claimIds: z.array(z.string()),
});
export type RewriteResponse = z.infer<typeof rewriteResponseSchema>;

/** Cohort card summary. */
export type PatientSummary = {
  patientId: number;
  displayName: string;
  preferredName: string;
  age: number;
  sex: string;
  ageBand: AgeBand;
  audience: Audience;
  caregiver: string | null;
  personaArchetype: string;
  primaryDiagnoses: string[];
  upcomingVisit: UpcomingVisit;
  language: Language;
  dementia: boolean;
  demoRole: DemoRole;
  encounterCount: number;
  latestRun: { id: string; createdAt: string; source: RunSource; approvedCount: number; touchpointCount: number } | null;
};

export type OutboxMetrics = {
  namespace: Namespace;
  patientsWithRuns: number;
  touchpointsTotal: number;
  touchpointsApproved: number;
  avgReadingGradeGeneric: number;
  avgReadingGradePersona: number;
  avgTiScoreGeneric: number;
  avgTiScorePersona: number;
  stigmaTermsRemoved: number;
  privacyRulesEnforced: number;
  measuredOn: "stored runs";
};

export type ApiError = { error: string; details?: unknown };
